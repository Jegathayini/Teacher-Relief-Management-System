type Teacher={
    id:number
    name:string
    subject:string
}

const teachers:Teacher[] = [
    {id: 1, name:"Arun", subject:"Mathematics"},
    {id:2, name:"Priya", subject:"Science"},
    {id:3, name:"Nimal", subject:"English"}
]

function TeacherList(){
    return(
        <section className="bg-slate-800 p-6 rounded-lg">
            <h2 className="text-xl font-bold text-cyan-400">
                Teacher Management
            </h2>
            <div className="mt-4 space-y-3">
                {teachers.map((teacher)=>(
                        <div key={teacher.id} className="bg-slate-700 p-3 rounded-md">
                            <p className="text-white">{teacher.name}</p>
                            <p className="text-slate-300">{teacher.subject}</p>
                        </div>
                    ))}
            </div>
        </section>
    )
}

export default TeacherList
