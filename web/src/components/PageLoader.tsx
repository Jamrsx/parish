interface PageLoaderProps {
  /** Fill the whole viewport (app-level) or only the content area (inside a layout). */
  fullScreen?: boolean;
}

export default function PageLoader({ fullScreen = true }: PageLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-center ${
        fullScreen ? "min-h-screen bg-slate-50" : "min-h-[50vh]"
      }`}
    >
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      <span className="sr-only">Loading page…</span>
    </div>
  );
}
