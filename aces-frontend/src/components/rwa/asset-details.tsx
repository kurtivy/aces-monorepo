/**
 * AssetDetails — collapsible accordion for RWA token metadata.
 *
 * Three sections: About, Provenance, Relevant Links.
 * Only one section is open at a time (About is the default).
 * Clicking a closed header opens it and collapses the currently-open one.
 *
 * Styling mirrors other card components on the token page
 * (rounded bg-card-surface with glow border on hover).
 */

import { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { cn } from "~/lib/utils";

// ── Types ──────────────────────────────────────────────

interface AssetDetailsProps {
  /** Primary description shown in the "About" section */
  description: string;
  /** Optional provenance / authenticity narrative */
  provenance?: string;
  /** Optional external links (docs, marketplace, etc.) */
  links?: { label: string; url: string }[];
}

// ── Accordion section IDs ──────────────────────────────
// Using a union type so we can track which section is open.
type SectionId = "about" | "provenance" | "links";

/** Configuration for each accordion section */
interface SectionConfig {
  id: SectionId;
  title: string;
  /** Returns true when the section has renderable content */
  hasContent: (props: AssetDetailsProps) => boolean;
}

/**
 * Static section definitions.
 * About is always present; Provenance and Links are optional.
 */
const SECTIONS: SectionConfig[] = [
  {
    id: "about",
    title: "About",
    hasContent: (p) => !!p.description,
  },
  {
    id: "provenance",
    title: "Provenance",
    hasContent: (p) => !!p.provenance,
  },
  {
    id: "links",
    title: "Relevant Links",
    hasContent: (p) => !!p.links && p.links.length > 0,
  },
];

// ── Component ──────────────────────────────────────────

export function AssetDetails({ description, provenance, links }: AssetDetailsProps) {
  // Only one section open at a time — "about" is the default.
  const [openSection, setOpenSection] = useState<SectionId>("about");

  /**
   * Toggle handler: clicking the currently-open section closes it (sets null),
   * clicking a closed section opens it and implicitly closes the other.
   */
  const toggle = (id: SectionId) => {
    setOpenSection((prev) => (prev === id ? (null as unknown as SectionId) : id));
  };

  // Bundle props for the hasContent check
  const props: AssetDetailsProps = { description, provenance, links };

  // Filter to sections that actually have content to show
  const visibleSections = SECTIONS.filter((s) => s.hasContent(props));

  return (
    <div className="rounded bg-card-surface glow-border-hover card-glow overflow-hidden">
      {visibleSections.map((section, idx) => {
        const isOpen = openSection === section.id;

        return (
          <div key={section.id}>
            {/* Divider between sections (skip before the first one) */}
            {idx > 0 && (
              <div className="h-px w-full bg-golden-beige/8" />
            )}

            {/* Section header — clickable toggle */}
            <button
              onClick={() => toggle(section.id)}
              className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-golden-beige/5"
              aria-expanded={isOpen}
            >
              <span className="text-xs font-medium uppercase tracking-wider text-platinum-grey/70">
                {section.title}
              </span>
              {/* Chevron rotates 180deg when the section is open */}
              <ChevronDown
                size={16}
                className={cn(
                  "text-platinum-grey/50 transition-transform duration-200",
                  isOpen && "rotate-180",
                )}
              />
            </button>

            {/* Collapsible content area.
                Uses grid-rows trick for smooth height animation:
                grid-rows-[0fr] collapses to 0 height,
                grid-rows-[1fr] expands to content height. */}
            <div
              className={cn(
                "grid transition-[grid-template-rows] duration-200 ease-in-out",
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden">
                <div className="px-5 pb-4">
                  {/* Render the appropriate content for each section */}
                  {section.id === "about" && (
                    <p className="text-sm leading-relaxed text-platinum-grey/75 whitespace-pre-line">
                      {description}
                    </p>
                  )}

                  {section.id === "provenance" && provenance && (
                    <p className="text-sm leading-relaxed text-platinum-grey/75 whitespace-pre-line">
                      {provenance}
                    </p>
                  )}

                  {section.id === "links" && links && links.length > 0 && (
                    <ul className="space-y-2">
                      {links.map((link) => (
                        <li key={link.url}>
                          {/* External link with golden-beige hover + icon */}
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-platinum-grey/75 hover:text-golden-beige transition-colors"
                          >
                            {link.label}
                            <ExternalLink size={13} className="opacity-60" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
