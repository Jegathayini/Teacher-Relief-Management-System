import { useState } from "react"

type Teacher = {
  id: number
  name: string
  subject: string
}

function TeacherList() {
  const [teachers, setTeachers] = useState<Teacher[]>([
    { id: 1, name: "Arun", subject: "Mathematics" },
    { id: 2, name: "Priya", subject: "Science" },
    { id: 3, name: "Nimal", subject: "English" }
  ])

  const [teacherName, setTeacherName] = useState("")
  const [teacherSubject, setTeacherSubject] = useState("")
  function handleAddTeacher() {
    if (teacherName.trim() === "" || teacherSubject.trim() === "") {
        alert("Please enter both teacher name and subject")
        return
    }
    const newTeacher: Teacher = {
        id: Date.now(),
        name: teacherName,
        subject: teacherSubject
    }

    setTeachers([...teachers, newTeacher])
    // Clear both input fields
    setTeacherName("")
    setTeacherSubject("")
    }
  return (
    <section className="bg-slate-800 p-6 rounded-lg">
      <h2 className="text-xl font-bold text-cyan-400">
        Teacher Management
      </h2>

      <input
        type="text"
        placeholder="Enter teacher name"
        value={teacherName}
        onChange={(e) => setTeacherName(e.target.value)}
        className="bg-slate-700 text-white p-3 rounded-lg mt-4 w-full"
      />
      <input
        type="text"
        placeholder="Enter teacher subject"
        value={teacherSubject}
        onChange={(e) => setTeacherSubject(e.target.value)}
        className="bg-slate-700 text-white p-3 rounded-lg mt-4 w-full"
       />

       <button
        onClick={handleAddTeacher}
        className="bg-cyan-500 text-slate-900 font-bold px-6 py-3 rounded-lg mt-4 hover:bg-cyan-400"
        >
        Add Teacher
       </button>

      <p className="text-slate-300 mt-2">
        Teacher Name: {teacherName}
      </p>
      <p className="text-slate-300 mt-2">
        Teacher Subject: {teacherSubject}
      </p>

      <div className="mt-4 space-y-3">
        {teachers.map((teacher) => (
          <div
            key={teacher.id}
            className="bg-slate-700 p-3 rounded-md"
          >
            <p className="text-white">{teacher.name}</p>
            <p className="text-slate-300">{teacher.subject}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default TeacherList