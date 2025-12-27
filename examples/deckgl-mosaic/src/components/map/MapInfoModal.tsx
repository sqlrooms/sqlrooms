interface MapInfoModalProps {
  onClose: () => void;
}

export function MapInfoModal({onClose}: MapInfoModalProps) {
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-96 rounded-md border border-slate-700 bg-[#1f1d1b] p-6 text-slate-200">
        <div className="space-y-3 text-sm leading-relaxed">
          <p>
            This is an experimental interface showing linked visual exploration
            across maps and charts. Interactions on the map and histograms
            update each other in real time.
          </p>
          <p>
            The app is built using DeckGL, Mosaic, DuckDB-WASM and GeoArrow for
            all analytical queries. All filtering happens locally in the browser
            with no backend involved.
          </p>
        </div>
        <button
          onClick={onClose}
          className="mt-5 w-full rounded bg-[#e67f5f] py-2 text-sm text-white"
        >
          Close
        </button>
      </div>
    </div>
  );
}
