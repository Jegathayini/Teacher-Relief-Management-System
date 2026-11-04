"""Authenticated, school-scoped cloud operations for ReliefMS."""
from datetime import date
from uuid import uuid4
from flask import Blueprint, g, jsonify, request
from psycopg import errors
from auth_middleware import require_school_admin
from postgres_database import get_postgres_connection

cloud = Blueprint('cloud_operations', __name__, url_prefix='/api/cloud/v2')
DAYS = {'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'}

@cloud.before_request
def authenticate():
    if request.method == 'OPTIONS':
        return None
    @require_school_admin
    def check():
        return None
    return check()

def bad(message, status=400):
    return jsonify({'message': message}), status

def valid_day_period(day, period):
    return day in DAYS and type(period) is int and 1 <= period <= 8

def valid_date(value):
    try:
        return isinstance(value, str) and date.fromisoformat(value).isoformat() == value
    except ValueError:
        return False

def teacher_exists(c, teacher_id, active=True):
    c.execute('SELECT active, subjects FROM teachers WHERE school_id=%s AND id=%s', (g.school_id, teacher_id))
    row = c.fetchone()
    return row if row and (not active or row['active']) else None

def teacher_subjects(row):
    subjects = row['subjects']
    if isinstance(subjects, str):
        return [x.strip() for x in subjects.split(',') if x.strip()]
    return subjects or []

@cloud.get('/teachers')
def teachers():
    with get_postgres_connection() as conn, conn.cursor() as c:
        c.execute('SELECT id,name,subjects,active FROM teachers WHERE school_id=%s ORDER BY name', (g.school_id,))
        return jsonify([dict(id=r['id'], name=r['name'], subjects=teacher_subjects(r), active=bool(r['active'])) for r in c.fetchall()])

@cloud.get('/timetables')
def timetables():
    with get_postgres_connection() as conn, conn.cursor() as c:
        c.execute('SELECT id,teacher_id,class_name,subject,day,period FROM timetables WHERE school_id=%s ORDER BY day,period,class_name', (g.school_id,))
        return jsonify([dict(id=r['id'],teacherId=r['teacher_id'],className=r['class_name'],subject=r['subject'],day=r['day'],period=r['period']) for r in c.fetchall()])

@cloud.post('/timetables')
def add_timetable():
    d=request.get_json(silent=True) or {}
    teacher_id, day, period=d.get('teacherId'),d.get('day'),d.get('period')
    cls,subject=d.get('className'),d.get('subject')
    if not valid_day_period(day,period) or not all(isinstance(x,str) and x.strip() for x in (teacher_id,cls,subject)):
        return bad('Teacher, class, subject, school day and period are required.')
    cls,subject=cls.strip(),subject.strip()
    with get_postgres_connection() as conn, conn.cursor() as c:
        c.execute('SELECT pg_advisory_xact_lock(hashtext(%s))', (str(g.school_id),))
        teacher=teacher_exists(c,teacher_id)
        if not teacher or subject not in teacher_subjects(teacher):
            return bad('Teacher is inactive or does not teach this subject.',409)
        c.execute('SELECT id FROM timetables WHERE school_id=%s AND day=%s AND period=%s AND (teacher_id=%s OR lower(class_name)=lower(%s))', (g.school_id,day,period,teacher_id,cls))
        if c.fetchone():return bad('Teacher or class is already scheduled in this period.',409)
        tid=str(uuid4())
        c.execute('INSERT INTO timetables(id,school_id,teacher_id,class_name,subject,day,period) VALUES (%s,%s,%s,%s,%s,%s,%s)', (tid,g.school_id,teacher_id,cls,subject,day,period))
        c.execute("DELETE FROM timetable_progress WHERE school_id=%s AND teacher_id=%s AND day=%s AND period=%s", (g.school_id,teacher_id,day,period))
    return jsonify(dict(id=tid,teacherId=teacher_id,className=cls,subject=subject,day=day,period=period)),201

@cloud.delete('/timetables/<entry_id>')
def remove_timetable(entry_id):
    with get_postgres_connection() as conn,conn.cursor() as c:
        c.execute('DELETE FROM timetables WHERE school_id=%s AND id=%s RETURNING id', (g.school_id,entry_id))
        if not c.fetchone():return bad('Lesson not found.',404)
    return jsonify(message='Lesson removed.')

@cloud.get('/timetable-progress/<teacher_id>')
def progress(teacher_id):
    with get_postgres_connection() as conn,conn.cursor() as c:
        if not teacher_exists(c,teacher_id,False):return bad('Teacher not found.',404)
        c.execute('''SELECT day,period,status FROM timetable_progress p WHERE school_id=%s AND teacher_id=%s
        AND NOT EXISTS (SELECT 1 FROM timetables t WHERE t.school_id=p.school_id AND t.teacher_id=p.teacher_id AND t.day=p.day AND t.period=p.period)
        UNION ALL SELECT day,period,'LESSON' AS status FROM timetables WHERE school_id=%s AND teacher_id=%s''',(g.school_id,teacher_id,g.school_id,teacher_id))
        return jsonify(c.fetchall())

@cloud.put('/timetable-period')
def edit_period():
    d=request.get_json(silent=True) or {}
    teacher_id,day,period,status=d.get('teacherId'),d.get('day'),d.get('period'),d.get('status')
    if not isinstance(teacher_id,str) or not valid_day_period(day,period) or status not in ('FREE','LESSON'):
        return bad('Invalid timetable period.')
    with get_postgres_connection() as conn,conn.cursor() as c:
        c.execute('SELECT pg_advisory_xact_lock(hashtext(%s))', (str(g.school_id),))
        teacher=teacher_exists(c,teacher_id)
        if not teacher:return bad('Teacher not found or inactive.',409)
        c.execute('SELECT id FROM timetables WHERE school_id=%s AND teacher_id=%s AND day=%s AND period=%s',(g.school_id,teacher_id,day,period))
        old=c.fetchone()
        if status=='FREE':
            if old:c.execute('DELETE FROM timetables WHERE school_id=%s AND id=%s',(g.school_id,old['id']))
            c.execute('DELETE FROM timetable_progress WHERE school_id=%s AND teacher_id=%s AND day=%s AND period=%s',(g.school_id,teacher_id,day,period))
            c.execute("INSERT INTO timetable_progress(school_id,teacher_id,day,period,status) VALUES (%s,%s,%s,%s,'FREE')",(g.school_id,teacher_id,day,period))
            return jsonify(status='FREE',message='Free period saved.')
        cls,subject=d.get('className'),d.get('subject')
        if not isinstance(cls,str) or not cls.strip() or not isinstance(subject,str) or subject not in teacher_subjects(teacher):
            return bad('Valid class and teacher subject required.')
        cls=cls.strip()
        c.execute('SELECT id FROM timetables WHERE school_id=%s AND day=%s AND period=%s AND lower(class_name)=lower(%s) AND id IS DISTINCT FROM %s',(g.school_id,day,period,cls,old['id'] if old else None))
        if c.fetchone():return bad('Class already has a lesson.',409)
        if old:
            c.execute('UPDATE timetables SET class_name=%s,subject=%s WHERE school_id=%s AND id=%s',(cls,subject,g.school_id,old['id']))
            entry_id=old['id']
        else:
            entry_id=str(uuid4())
            c.execute('INSERT INTO timetables(id,school_id,teacher_id,class_name,subject,day,period) VALUES (%s,%s,%s,%s,%s,%s,%s)',(entry_id,g.school_id,teacher_id,cls,subject,day,period))
        c.execute('DELETE FROM timetable_progress WHERE school_id=%s AND teacher_id=%s AND day=%s AND period=%s',(g.school_id,teacher_id,day,period))
        return jsonify(status='LESSON',entry=dict(id=entry_id,teacherId=teacher_id,className=cls,subject=subject,day=day,period=period))

@cloud.put('/timetable-progress/free')
def save_free():
    d=request.get_json(silent=True) or {}
    d['status']='FREE'
    # Preserve legacy behavior: reject changing a lesson to FREE here.
    with get_postgres_connection() as conn,conn.cursor() as c:
        c.execute('SELECT id FROM timetables WHERE school_id=%s AND teacher_id=%s AND day=%s AND period=%s',(g.school_id,d.get('teacherId'),d.get('day'),d.get('period')))
        if c.fetchone():return bad('Period already has a lesson. Edit it first.',409)
    return edit_period_with_data(d)

def edit_period_with_data(d):
    # For compatibility with free-period wizard.
    teacher_id,day,period=d.get('teacherId'),d.get('day'),d.get('period')
    if not isinstance(teacher_id,str) or not valid_day_period(day,period):return bad('Invalid period.')
    with get_postgres_connection() as conn,conn.cursor() as c:
        if not teacher_exists(c,teacher_id):return bad('Teacher not found or inactive.',409)
        c.execute('DELETE FROM timetable_progress WHERE school_id=%s AND teacher_id=%s AND day=%s AND period=%s',(g.school_id,teacher_id,day,period))
        c.execute("INSERT INTO timetable_progress(school_id,teacher_id,day,period,status) VALUES (%s,%s,%s,%s,'FREE')",(g.school_id,teacher_id,day,period))
    return jsonify(status='FREE',teacherId=teacher_id,day=day,period=period)

@cloud.route('/absences',methods=['GET','POST'])
def absences():
    if request.method=='GET':
        with get_postgres_connection() as conn,conn.cursor() as c:
            c.execute('SELECT id,teacher_id,date,reason FROM absences WHERE school_id=%s ORDER BY date DESC',(g.school_id,))
            return jsonify([dict(id=r['id'],teacherId=r['teacher_id'],date=str(r['date']),reason=r['reason']) for r in c.fetchall()])
    d=request.get_json(silent=True) or {}
    teacher_id,when,reason=d.get('teacherId'),d.get('date'),d.get('reason','')
    if not isinstance(teacher_id,str) or not valid_date(when) or not isinstance(reason,str):return bad('Invalid absence.')
    with get_postgres_connection() as conn,conn.cursor() as c:
        if not teacher_exists(c,teacher_id):return bad('Teacher not found or inactive.',409)
        c.execute('SELECT id FROM absences WHERE school_id=%s AND teacher_id=%s AND date=%s',(g.school_id,teacher_id,when))
        if c.fetchone():return bad('Teacher already marked absent.',409)
        aid=str(uuid4())
        c.execute('INSERT INTO absences(id,school_id,teacher_id,date,reason) VALUES (%s,%s,%s,%s,%s)',(aid,g.school_id,teacher_id,when,reason.strip()))
    return jsonify(id=aid,teacherId=teacher_id,date=when,reason=reason.strip()),201

@cloud.delete('/absences/<absence_id>')
def remove_absence(absence_id):
    with get_postgres_connection() as conn,conn.cursor() as c:
        c.execute('SELECT teacher_id,date FROM absences WHERE school_id=%s AND id=%s',(g.school_id,absence_id))
        row=c.fetchone()
        if not row:return bad('Absence not found.',404)
        c.execute('SELECT id FROM relief_assignments WHERE school_id=%s AND absent_teacher_id=%s AND date=%s LIMIT 1',(g.school_id,row['teacher_id'],row['date']))
        if c.fetchone():return bad('Remove related relief assignments first.',409)
        c.execute('DELETE FROM absences WHERE school_id=%s AND id=%s',(g.school_id,absence_id))
    return jsonify(message='Absence deleted.')

@cloud.route('/relief-assignments',methods=['GET','POST'])
def assignments():
    if request.method=='GET':
        with get_postgres_connection() as conn,conn.cursor() as c:
            c.execute('SELECT id,date,period,class_name,absent_teacher_id,relief_teacher_id,subject FROM relief_assignments WHERE school_id=%s ORDER BY date DESC,period,class_name',(g.school_id,))
            return jsonify([dict(id=r['id'],date=str(r['date']),period=r['period'],className=r['class_name'],absentTeacherId=r['absent_teacher_id'],reliefTeacherId=r['relief_teacher_id'],subject=r['subject']) for r in c.fetchall()])
    d=request.get_json(silent=True) or {}
    when,period,cls,absent,relief,subject=(d.get(k) for k in ('date','period','className','absentTeacherId','reliefTeacherId','subject'))
    if not valid_date(when) or date.fromisoformat(when).strftime('%A') not in DAYS or type(period) is not int or not 1<=period<=8:
        return bad('Invalid school date or period.')
    if not all(isinstance(x,str) and x.strip() for x in (cls,absent,relief,subject)) or absent==relief:return bad('Invalid assignment.')
    cls,subject=cls.strip(),subject.strip()
    day=date.fromisoformat(when).strftime('%A')
    with get_postgres_connection() as conn,conn.cursor() as c:
        c.execute('SELECT pg_advisory_xact_lock(hashtext(%s))',(str(g.school_id),))
        if not teacher_exists(c,relief):return bad('Relief teacher inactive or missing.',409)
        c.execute('SELECT id FROM timetables WHERE school_id=%s AND day=%s AND period=%s AND teacher_id=%s AND lower(class_name)=lower(%s) AND subject=%s',(g.school_id,day,period,absent,cls,subject))
        if not c.fetchone():return bad('Original lesson not found.',409)
        c.execute('SELECT id FROM absences WHERE school_id=%s AND teacher_id=%s AND date=%s',(g.school_id,absent,when))
        if not c.fetchone():return bad('Original teacher is not absent.',409)
        c.execute('SELECT id FROM absences WHERE school_id=%s AND teacher_id=%s AND date=%s',(g.school_id,relief,when))
        if c.fetchone():return bad('Relief teacher is absent.',409)
        c.execute('SELECT id FROM timetables WHERE school_id=%s AND teacher_id=%s AND day=%s AND period=%s',(g.school_id,relief,day,period))
        if c.fetchone():return bad('Relief teacher has a lesson.',409)
        c.execute('SELECT id FROM relief_assignments WHERE school_id=%s AND date=%s AND period=%s AND (relief_teacher_id=%s OR lower(class_name)=lower(%s))',(g.school_id,when,period,relief,cls))
        if c.fetchone():return bad('Relief teacher or class already assigned.',409)
        rid=str(uuid4())
        c.execute('INSERT INTO relief_assignments(id,school_id,date,period,class_name,absent_teacher_id,relief_teacher_id,subject) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)',(rid,g.school_id,when,period,cls,absent,relief,subject))
    return jsonify(id=rid,date=when,period=period,className=cls,absentTeacherId=absent,reliefTeacherId=relief,subject=subject),201

@cloud.delete('/relief-assignments/<assignment_id>')
def remove_assignment(assignment_id):
    with get_postgres_connection() as conn,conn.cursor() as c:
        c.execute('DELETE FROM relief_assignments WHERE school_id=%s AND id=%s RETURNING id',(g.school_id,assignment_id))
        if not c.fetchone():return bad('Assignment not found.',404)
    return jsonify(message='Relief assignment deleted.')

@cloud.get('/dashboard')
def dashboard():
    when=request.args.get('date',date.today().isoformat())
    if not valid_date(when):return bad('Invalid date.')
    day=date.fromisoformat(when).strftime('%A')
    with get_postgres_connection() as conn,conn.cursor() as c:
        c.execute('SELECT count(*) AS n FROM absences WHERE school_id=%s AND date=%s',(g.school_id,when))
        absent=c.fetchone()['n']
        c.execute('SELECT count(*) AS n FROM relief_assignments WHERE school_id=%s AND date=%s',(g.school_id,when))
        assigned=c.fetchone()['n']
        c.execute("""SELECT count(*) AS n FROM timetables t JOIN absences a
          ON a.school_id=t.school_id AND a.teacher_id=t.teacher_id AND a.date=%s
          WHERE t.school_id=%s AND t.day=%s AND NOT EXISTS
          (SELECT 1 FROM relief_assignments r WHERE r.school_id=t.school_id AND r.date=%s
            AND r.period=t.period AND lower(r.class_name)=lower(t.class_name))""",(when,g.school_id,day,when))
        pending=c.fetchone()['n']
    return jsonify(absentTeachers=absent,reliefAssigned=assigned,pendingRelief=pending)
