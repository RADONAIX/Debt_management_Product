import { NavLink } from "./NavLink";
import { ThemeToggle } from "./ThemeToggle";

export const HeaderWithNav = () => {
  return (
    <header className="bg-background border-b border-border">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-semibold text-foreground">Debt Collection Strategy Designer</h1>
          <nav className="flex items-center gap-4">
            <NavLink to="/">Designer</NavLink>
            <NavLink to="/strategy-library">Strategy Library</NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};