export const SlideDivider = ({ title }) => (
    <div className="flex flex-col items-start justify-center h-full w-full bg-blue-900 px-24 animate-in fade-in slide-in-from-right-8 duration-500">
        <h2 className="text-5xl font-serif font-black text-white mb-4">{title}</h2>
        <div className="w-24 h-1.5 bg-blue-400"></div>
    </div>
);
