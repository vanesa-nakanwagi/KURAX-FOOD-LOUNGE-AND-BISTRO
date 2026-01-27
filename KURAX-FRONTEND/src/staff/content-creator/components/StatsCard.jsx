
export default function StatsCard({ title, value }) {
  return (
    <div className="bg-gray-800 p-4 rounded shadow">
      <h3 className="text-gray-400">{title}</h3>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  )
}
