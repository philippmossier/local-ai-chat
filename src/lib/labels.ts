import { decimal } from "./format";
import type { ReasonId } from "./hardware/classify";
import type { Fit } from "./hardware/types";
import { tr } from "./lang";
import type { Tier } from "./models/catalog";
import type { HostKind } from "./privacy/network";

// Text that is chosen by a value at run time (a tier, a fit, a reason id). Each lookup is exhaustive:
// the compiler fails the build if a new tier, fit, reason or host kind has no text.

export const tierLabel = (tier: Tier): string =>
  ({
    light: tr("Light", "Leicht"),
    balanced: tr("Balanced", "Ausgewogen"),
    strong: tr("Strong", "Stark"),
    best: tr("Best quality", "Beste Qualität"),
  })[tier];

export const fitLabel = (fit: Fit): string =>
  ({
    recommended: tr("Recommended", "Empfohlen"),
    good: tr("Runs well", "Läuft gut"),
    slow: tr(
      "Heavy: may be slow or need a lot of memory",
      "Schwer: kann langsam sein oder viel Speicher brauchen",
    ),
    "not-advised": tr("Too heavy for this device", "Zu schwer für dieses Gerät"),
  })[fit];

export const hostKindLabel = (kind: HostKind): string =>
  ({
    model: tr(
      "Model files (download only, nothing is uploaded)",
      "Modelldateien (nur Download, nichts wird hochgeladen)",
    ),
    app: tr("This app (its own code)", "Diese App (ihr eigener Code)"),
    other: tr("Other", "Sonstiges"),
  })[kind];

/** Why the hardware check came out the way it did. `gbs` is the measured GPU speed. */
export function reasonText(id: ReasonId, gbs: number): string {
  switch (id) {
    case "hw.noWasm":
      return tr(
        "This browser cannot run the AI engine. Please use a current version of Chrome, Edge, Safari or Firefox.",
        "Dieser Browser kann die KI-Engine nicht ausführen. Bitte verwenden Sie eine aktuelle Version von Chrome, Edge, Safari oder Firefox.",
      );
    case "hw.insecure":
      return tr(
        "This page must be opened over a secure connection (https) so the model can be stored on your device.",
        "Diese Seite muss über eine sichere Verbindung (https) geöffnet werden, damit das Modell auf Ihrem Gerät gespeichert werden kann.",
      );
    case "hw.lowMemory":
      return tr(
        "Your device reports little memory, so only the smallest model is offered.",
        "Ihr Gerät meldet wenig Arbeitsspeicher, daher wird nur das kleinste Modell angeboten.",
      );
    case "hw.mobile":
      return tr(
        "On phones and tablets only the smallest model is offered, to save battery and data.",
        "Auf Handys und Tablets wird nur das kleinste Modell angeboten, um Akku und Datenvolumen zu schonen.",
      );
    case "hw.softwareGpu":
      return tr(
        "Your browser only offers software graphics, so the app uses your processor instead.",
        "Ihr Browser bietet nur Software-Grafik, deshalb nutzt die App stattdessen Ihren Prozessor.",
      );
    case "hw.noWebgpu":
      return tr(
        "Your browser does not offer graphics acceleration (WebGPU), so the app uses your processor, which is slower. Current Chrome or Edge usually unlock the faster mode.",
        "Ihr Browser bietet keine Grafikbeschleunigung (WebGPU), deshalb nutzt die App Ihren Prozessor. Das ist langsamer. Aktuelles Chrome oder Edge schalten meist den schnelleren Modus frei.",
      );
    case "hw.speedFast":
      return tr(
        `A quick speed test of your graphics processor (${decimal(gbs)} GB/s) shows it is fast enough for strong models.`,
        `Ein kurzer Geschwindigkeitstest Ihres Grafikprozessors (${decimal(gbs)} GB/s) zeigt: schnell genug für starke Modelle.`,
      );
    case "hw.speedMedium":
      return tr(
        `A quick speed test of your graphics processor (${decimal(gbs)} GB/s) shows it is good for small to medium models.`,
        `Ein kurzer Geschwindigkeitstest Ihres Grafikprozessors (${decimal(gbs)} GB/s) zeigt: gut für kleine bis mittlere Modelle.`,
      );
    case "hw.speedSlow":
      return tr(
        `A quick speed test of your graphics processor (${decimal(gbs)} GB/s) shows it is slow, so only the smallest model will feel fast.`,
        `Ein kurzer Geschwindigkeitstest Ihres Grafikprozessors (${decimal(gbs)} GB/s) zeigt: langsam, daher fühlt sich nur das kleinste Modell flott an.`,
      );
    case "hw.appleSilicon":
      return tr(
        "Your Mac has an Apple chip with a fast built-in graphics processor. That is ideal for running AI locally.",
        "Ihr Mac hat einen Apple-Chip mit schnellem integriertem Grafikprozessor. Das ist ideal, um KI lokal auszuführen.",
      );
    case "hw.dedicatedGpu":
      return tr(
        "Your computer has a powerful graphics card, which makes local AI fast.",
        "Ihr Computer hat eine leistungsstarke Grafikkarte, mit der lokale KI schnell läuft.",
      );
    case "hw.intelGpu":
      return tr(
        "Your computer has integrated Intel graphics. It runs smaller models comfortably.",
        "Ihr Computer hat integrierte Intel-Grafik. Kleinere Modelle laufen damit gut.",
      );
    case "hw.basicGpu":
      return tr(
        "Your computer has a graphics processor that can run small to medium models.",
        "Ihr Computer hat einen Grafikprozessor, der kleine bis mittlere Modelle ausführen kann.",
      );
  }
}

export const trustPoints = (): string[] => [
  tr(
    "Your messages never leave this device.",
    "Ihre Nachrichten verlassen dieses Gerät nicht.",
  ),
  tr(
    "No account, no tracking, no server that sees your text.",
    "Kein Konto, kein Tracking, kein Server, der Ihren Text sieht.",
  ),
  tr(
    "After a one-time download it also works offline.",
    "Nach einem einmaligen Download funktioniert es auch offline.",
  ),
];

/** Conversation starters: a short label and the text that is put into the message box. */
export const starters = (): { label: string; prompt: string }[] => [
  {
    label: tr("Summarize a text", "Text zusammenfassen"),
    prompt: tr(
      "Summarize the following text in three short bullet points:\n\n",
      "Fasse den folgenden Text in drei kurzen Stichpunkten zusammen:\n\n",
    ),
  },
  {
    label: tr("Write an email", "E-Mail schreiben"),
    prompt: tr(
      "Help me write a polite, concise email. The situation is: ",
      "Hilf mir, eine höfliche, knappe E-Mail zu schreiben. Die Situation ist: ",
    ),
  },
  {
    label: tr("Explain simply", "Einfach erklären"),
    prompt: tr(
      "Explain this in simple words, as if to a beginner: ",
      "Erkläre das in einfachen Worten, so als wäre ich Anfänger: ",
    ),
  },
  {
    label: tr("Translate", "Übersetzen"),
    prompt: tr(
      "Translate the following text into English:\n\n",
      "Übersetze den folgenden Text ins Deutsche:\n\n",
    ),
  },
];
