import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { tr } from "~/lib/lang";
import { setTheme, useThemePreference, type ThemePreference } from "~/lib/theme";

/** Light, dark, or follow the system. The choice is remembered in this browser. */
export function ThemeMenu() {
  const pref = useThemePreference();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={tr("Appearance", "Darstellung")}
          />
        }
      >
        <SunIcon className="dark:hidden" />
        <MoonIcon className="hidden dark:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={pref}
          onValueChange={(v) => setTheme(v as ThemePreference)}
        >
          <DropdownMenuRadioItem value="light">
            <SunIcon />
            {tr("Light", "Hell")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <MoonIcon />
            {tr("Dark", "Dunkel")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <MonitorIcon />
            {tr("System", "System")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
