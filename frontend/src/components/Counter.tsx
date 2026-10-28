import {useState} from "react"

function Counter() {
    const [count, setcount]=useState(0)

    return(
        <div className="bg-slate-800 p-6 rounded-lg">
            <p className="text-white">Count: {count}</p>

            <button onClick={() => setcount(count + 1)}
            className="bg-cyan-500 text-slate-900 px-4 py-2 rounded-lg mt-3">
                Increase
            </button>
        </div>
    )
}

export default Counter