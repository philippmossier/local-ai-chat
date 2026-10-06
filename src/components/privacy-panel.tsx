import { ShieldCheckIcon } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Separator } from "~/components/ui/separator";
import type { ResourceRecord } from "~/lib/engine/protocol";
import { formatBytes } from "~/lib/format";
import { hostKindLabel } from "~/lib/labels";
import { tr } from "~/lib/lang";
import { summarizeNetwork } from "~/lib/privacy/network";
import { wipeAllData } from "~/lib/privacy/wipe";

const requests = (n: number) =>
  tr(
    `${n} ${n === 1 ? "request" : "requests"}`,
    `${n} ${n === 1 ? "Anfrage" : "Anfragen"}`,
  );

/** What leaves the device, as a measurement: a live count of network requests since the first message. */
export function PrivacyPanel({
  open,
  onOpenChange,
  records,
  firstMessageAt,
  onWiped,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  records: ResourceRecord[];
  firstMessageAt: number | null;
  onWiped: () => void;
}) {
  const [done, setDone] = useState(false);
  const summary = summarizeNetwork(records, location.host, firstMessageAt);
  const after = summary.requestsAfterFirstMessage;

  async function wipe() {
    await wipeAllData();
    setDone(true);
    onWiped();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {tr("What leaves your device", "Was Ihr Gerät verlässt")}
          </DialogTitle>
          <DialogDescription>
            {tr(
              "Your messages are processed by a model running inside this browser tab. They are never sent to a server, and the app has no backend that could receive them.",
              "Ihre Nachrichten werden von einem Modell verarbeitet, das in diesem Browser-Tab läuft. Sie werden nie an einen Server gesendet, und die App hat kein Backend, das sie empfangen könnte.",
            )}
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <ShieldCheckIcon />
          <AlertTitle>
            {tr("Measured, not promised", "Gemessen, nicht versprochen")}
          </AlertTitle>
          <AlertDescription>
            <p className="text-base font-semibold text-foreground">
              {after === null
                ? tr(
                    "Send a message to start the counter.",
                    "Senden Sie eine Nachricht, um den Zähler zu starten.",
                  )
                : after === 0
                  ? tr(
                      "Network requests since your first message: none",
                      "Netzwerkanfragen seit Ihrer ersten Nachricht: keine",
                    )
                  : tr(
                      `Network requests since your first message: ${after}`,
                      `Netzwerkanfragen seit Ihrer ersten Nachricht: ${after}`,
                    )}
            </p>
            <p>
              {tr(
                "Measured live in this browser. You can confirm it yourself in your browser's developer tools (Network tab).",
                "Live in diesem Browser gemessen. Sie können es selbst in den Entwicklertools Ihres Browsers prüfen (Tab Netzwerk).",
              )}
            </p>
          </AlertDescription>
        </Alert>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">
            {tr(
              "Where data came from since this page opened",
              "Woher Daten kamen, seit diese Seite geöffnet wurde",
            )}
          </h3>
          <ul className="flex flex-col gap-2 text-sm">
            {summary.hosts.map((h) => (
              <li key={h.host} className="flex flex-col gap-1 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs">{h.host}</span>
                  <Badge variant={h.kind === "other" ? "destructive" : "secondary"}>
                    {h.kind === "app"
                      ? `${requests(h.requests)} · ${formatBytes(h.bytes)}`
                      : requests(h.requests)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{hostKindLabel(h.kind)}</p>
              </li>
            ))}
          </ul>
        </section>

        <p className="text-sm">
          {tr(
            "Try it: switch off your internet connection now. The chat keeps working.",
            "Probieren Sie es aus: Schalten Sie jetzt Ihre Internetverbindung aus. Der Chat funktioniert weiter.",
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          {tr(
            "Honest limits: the page itself and the model files are downloaded from the internet, and those servers see your IP address like any website does. Your typed text is not part of that.",
            "Ehrliche Grenzen: Die Seite selbst und die Modelldateien werden aus dem Internet geladen, und diese Server sehen Ihre IP-Adresse wie bei jeder Website. Ihr eingegebener Text gehört nicht dazu.",
          )}
        </p>

        <Separator />
        {done ? (
          <p className="text-sm text-primary">
            {tr(
              "Everything was removed from this browser.",
              "Alles wurde aus diesem Browser entfernt.",
            )}
          </p>
        ) : (
          <AlertDialog>
            <AlertDialogTrigger
              render={<Button variant="destructive" className="self-start" />}
            >
              {tr("Delete everything on this device", "Alles auf diesem Gerät löschen")}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {tr("Delete everything?", "Alles löschen?")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {tr(
                    "This removes the downloaded model, your chats and your settings from this browser.",
                    "Das entfernt das heruntergeladene Modell, Ihre Chats und Ihre Einstellungen aus diesem Browser.",
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{tr("Cancel", "Abbrechen")}</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => void wipe()}>
                  {tr("Delete", "Löschen")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
