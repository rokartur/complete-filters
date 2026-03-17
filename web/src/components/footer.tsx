export function Footer() {
  return (
    <footer className="relative border-t border-border/50">
      <div className="absolute inset-0 bg-linear-to-b from-transparent to-primary/2" />
      <div className="relative px-6 py-10 text-center">
        <div className="flex items-center justify-center gap-6 text-sm font-medium text-muted-foreground">
          <a
            href="https://github.com/rokartur/polish-complete-filters"
            className="hover:text-foreground transition-colors duration-200"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </div>
        <p className="mt-6 mx-auto max-w-2xl text-[11px] text-muted-foreground/50 leading-relaxed">
          Tester używa <code className="font-mono bg-muted/50 px-1.5 py-0.5 rounded text-foreground/50">preload</code>,{' '}
          <code className="font-mono bg-muted/50 px-1.5 py-0.5 rounded text-foreground/50">img</code> i{' '}
          <code className="font-mono bg-muted/50 px-1.5 py-0.5 rounded text-foreground/50">fetch</code> do ładowania zasobów
          z typem pasującym do reguł filtrów.
          Performance API weryfikuje czy żądanie dotarło do serwera, czy zostało zablokowane.
        </p>
      </div>
    </footer>
  )
}
