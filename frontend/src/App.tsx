import Header from "./components/Header"
import SummaryCard from "./components/SummaryCard"
import TeacherList from "./components/TeacherList"
import Counter from "./components/Counter"


const summaryData = [
  {title: "Total Teachers", count:25},
  {title: "Absent Today", count: 3},
  {title: "Relief Assigned", count: 6},
  {title: "Pending Relief", count: 2}
]

function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Header />
      <div className="grid grid-cols-2 md:grid-cols-4 p-6 gap-4">
        {summaryData.map((item)=> (
          <SummaryCard
          key={item.title}
          title={item.title}
          count={item.count}
          />
        ))}
      </div>  
      <div className="px-6 pb-6">
        <TeacherList/>
        <Counter/>
      </div>    
    </div>
  )
}

export default App