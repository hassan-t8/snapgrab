/** Shown instantly while a page's server work runs, so navigation never looks frozen. */
export default function Loading() {
  return (
    <section aria-busy="true" aria-label="Loading" className="px-4 pb-16 pt-10 sm:px-6 sm:pt-14 lg:px-8">
      <div className="mx-auto max-w-3xl animate-pulse text-center">
        <div className="mx-auto h-7 w-40 rounded-full surface" />
        <div className="mx-auto mt-6 h-10 w-full max-w-xl rounded-2xl surface sm:h-14" />
        <div className="mx-auto mt-3 h-10 w-3/4 max-w-md rounded-2xl surface sm:h-14" />
        <div className="mx-auto mt-6 h-4 w-full max-w-lg rounded-full surface" />
        <div className="mx-auto mt-2 h-4 w-2/3 max-w-sm rounded-full surface" />
        <div className="mt-10 h-72 rounded-[26px] surface" />
      </div>
    </section>
  );
}
