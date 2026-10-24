export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse space-y-6">
      <div className="h-8 w-56 rounded-xl surface" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-2xl surface" />
        ))}
      </div>
      <div className="h-80 rounded-2xl surface" />
    </div>
  );
}
