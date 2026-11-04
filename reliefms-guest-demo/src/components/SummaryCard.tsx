type SummaryCardProps={
    title: string
    count: number
}

function SummaryCard({ title, count }: SummaryCardProps){
    return (
        <div className="bg-slate-800 p-6 rounded-lg">
            <h2 className="text-slate-300">{title}</h2>
            <p className="text-3xl font-bold text-white">{count}</p>
        </div>
    )
}

export default SummaryCard