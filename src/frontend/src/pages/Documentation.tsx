import { Button } from "@/components/ui/button";
import { BookOpen, Printer } from "lucide-react";

interface SectionProps {
  number: string;
  title: string;
  children: React.ReactNode;
}

function Section({ number, title, children }: SectionProps) {
  return (
    <section className="mb-8 print:mb-6 print:break-inside-avoid">
      <div className="flex items-center gap-3 mb-3">
        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-sm font-bold text-primary print:bg-gray-200 print:border-gray-400 print:text-black">
          {number}
        </span>
        <h2 className="text-xl font-bold text-foreground print:text-black">
          {title}
        </h2>
      </div>
      <div className="pl-11 text-muted-foreground print:text-gray-700 space-y-2">
        {children}
      </div>
    </section>
  );
}

function Step({ steps }: { steps: string[] }) {
  return (
    <ol className="list-none space-y-1.5">
      {steps.map((step, i) => (
        <li key={step} className="flex items-start gap-2">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-xs font-semibold text-primary mt-0.5 print:bg-gray-100 print:border-gray-400 print:text-black">
            {i + 1}
          </span>
          <span className="text-sm leading-relaxed">{step}</span>
        </li>
      ))}
    </ol>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li
          key={item}
          className="flex items-start gap-2 text-sm leading-relaxed"
        >
          <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-primary mt-2 print:bg-black" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="font-semibold text-foreground min-w-36 print:text-black">
        {label}:
      </span>
      <span className="font-mono text-xs bg-muted rounded px-1.5 py-0.5 print:bg-gray-100 print:text-black">
        {value}
      </span>
    </div>
  );
}

export default function Documentation() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 print:py-0 print:px-6">
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          header, footer, nav { display: none !important; }
        }
      `}</style>

      {/* Screen header */}
      <div className="print:hidden mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                FaceAttend Documentation
              </h1>
              <p className="text-sm text-muted-foreground">
                Complete usage and technical reference
              </p>
            </div>
          </div>
          <Button
            onClick={() => window.print()}
            className="gap-2"
            data-ocid="docs.primary_button"
          >
            <Printer className="w-4 h-4" />
            Save as PDF
          </Button>
        </div>
        <div className="mt-6 h-px bg-border" />
      </div>

      {/* Print-only header */}
      <div className="hidden print:block mb-8 pb-4 border-b border-gray-300">
        <h1 className="text-3xl font-bold text-black">
          FaceAttend — User Documentation
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Facial Recognition Attendance System
        </p>
      </div>

      <Section number="1" title="App Overview">
        <p className="text-sm leading-relaxed">
          FaceAttend is a browser-based facial recognition attendance system for
          students and employees. It runs entirely in the browser — no
          server-side AI calls are made. All face detection and recognition
          happens locally on the device using TensorFlow.js, ensuring privacy
          and offline-capable operation once models are cached.
        </p>
      </Section>

      <Section number="2" title="Key Features">
        <Bullets
          items={[
            "Face Scan — attendance marking via AI face recognition",
            "Person Registration — separate flows for students and employees",
            "Attendance Reports with CSV export and date/month filtering",
            "Manage Persons — edit or delete registered persons and all their records",
            "Webhook integration for real-time notifications to your PC",
            "Settings — theme, background, typography, and webhook URL",
            "Fallback manual verification if AI models fail to load",
          ]}
        />
      </Section>

      <Section number="3" title="How to Use — Face Scan">
        <Step
          steps={[
            "Open the app — Face Scan is the landing page.",
            "Position your face in the camera frame.",
            "The AI will detect and match your face automatically.",
            "If AI is unavailable, select your name from the list and confirm.",
            "Attendance is recorded with entry time, date, month, and year automatically.",
          ]}
        />
      </Section>

      <Section number="4" title="How to Use — Register a Person">
        <Step
          steps={[
            "Go to Register in the navigation.",
            "Select type: Student or Employee.",
            "The camera opens automatically — position your face clearly.",
            'Click "Capture Face" to take a photo.',
            "Enter your name (required); ID and batch are optional.",
            "Click Register — you are now enrolled in the system.",
          ]}
        />
      </Section>

      <Section number="5" title="How to Use — Reports">
        <Step
          steps={[
            "Go to Report in the navigation.",
            "View all attendance records with entry time, date, month, and year.",
            "Filter by date or month using the filter controls at the top.",
            'Click "Download CSV" to export records as a spreadsheet.',
            "The page auto-refreshes every 10 seconds to show new entries.",
          ]}
        />
      </Section>

      <Section number="6" title="How to Use — Manage Persons">
        <Step
          steps={[
            "Go to Report → Manage Persons tab.",
            "Click Edit on a person to update their name, ID, batch, or face photo.",
            "Click Delete to permanently remove a person and all their attendance records.",
          ]}
        />
      </Section>

      <Section number="7" title="How to Use — Settings">
        <Bullets
          items={[
            "App Identity: change the app name and logo.",
            "Theme: switch between light, dark, and silver themes.",
            "Background: set a custom background image for the app.",
            "Typography: change the display font.",
            "Data Export: enter a webhook URL to receive attendance data after each verification.",
            "Install on Phone: add the app to your home screen as a PWA.",
          ]}
        />
      </Section>

      <Section number="8" title="Webhook / PC Integration">
        <p className="text-sm leading-relaxed mb-3">
          To receive attendance updates on your PC in real time:
        </p>
        <Step
          steps={[
            "Go to webhook.site on your PC and copy your unique URL.",
            "Open FaceAttend → Settings → Data Export.",
            "Paste the URL into the Webhook URL field and save.",
            "Every attendance verification will POST data to that URL automatically.",
          ]}
        />
        <div className="mt-3 p-3 rounded-lg bg-muted border border-border text-xs font-mono print:bg-gray-100 print:border-gray-300 print:text-black">
          Payload: name, personId, type (student/employee), date, month,
          entryTime, verificationCount
        </div>
        <p className="mt-3 text-sm">
          You can also connect it to Google Sheets or automation tools like{" "}
          <strong>Make (Integromat)</strong> or <strong>Zapier</strong> for
          advanced workflows.
        </p>
      </Section>

      <Section number="9" title="Technical Details">
        <div className="space-y-2">
          <InfoRow label="AI Library" value="@vladmandic/face-api" />
          <InfoRow label="Detection model" value="SSD MobileNet V1" />
          <InfoRow
            label="Recognition model"
            value="FaceNet (128-dim descriptors)"
          />
          <InfoRow label="Model source" value="jsDelivr CDN (browser-loaded)" />
          <InfoRow label="Match threshold" value="Euclidean distance < 0.6" />
          <InfoRow
            label="Camera API"
            value="getUserMedia (front camera default)"
          />
          <InfoRow
            label="Backend"
            value="Motoko canister on Internet Computer (ICP)"
          />
          <InfoRow
            label="Data storage"
            value="On-chain; no external database"
          />
        </div>
      </Section>

      <Section number="10" title="Troubleshooting">
        <div className="space-y-3">
          {(
            [
              [
                "Camera not opening on APK",
                "Enable Camera + Microphone permissions and WebRTC in WebIntoApp settings, then rebuild the APK.",
              ],
              [
                "Registration failed",
                "Ensure the camera has captured a face photo and a name is entered before clicking Register.",
              ],
              [
                "AI not loading",
                "Check your internet connection — models load from CDN. The app falls back to manual verification automatically.",
              ],
              [
                "Attendance not showing in Reports",
                "The Report page auto-refreshes every 10 seconds. Try switching tabs or waiting briefly.",
              ],
              [
                "Wrong date/time in Reports",
                "The app uses your device's local time. Ensure your device clock and timezone are correct.",
              ],
            ] as [string, string][]
          ).map(([problem, solution]) => (
            <div key={problem} className="text-sm">
              <span className="font-semibold text-foreground print:text-black">
                ⚠ {problem}:{" "}
              </span>
              <span>{solution}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section number="11" title="Credits">
        <p className="text-sm font-semibold text-foreground print:text-black">
          Developed by Atoto venyo
        </p>
      </Section>

      <div className="hidden print:block mt-12 pt-4 border-t border-gray-300 text-xs text-gray-400 text-center">
        FaceAttend — Facial Recognition Attendance System | Developed by Atoto
        venyo
      </div>
    </div>
  );
}
