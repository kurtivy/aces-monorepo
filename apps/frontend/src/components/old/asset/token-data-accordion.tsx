'use client';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface AccordionSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function AccordionSection({
  title,
  children,
  defaultOpen = true,
  className = '',
}: AccordionSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`space-y-4 ${className}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full bg-[#231f20]/50 rounded-xl p-4 flex items-center justify-between hover:bg-[#231f20]/70 transition-colors border border-[#D0B284]/20 group">
            <h2 className="text-xl font-bold text-white font-heading group-hover:text-[#D0B284] transition-colors">
              {title}
            </h2>
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#D0B284]/10 group-hover:bg-[#D0B284]/20 transition-colors">
              {isOpen ? (
                <ChevronUp className="w-5 h-5 text-[#D0B284]" />
              ) : (
                <ChevronDown className="w-5 h-5 text-[#D0B284]" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-6 mt-4 animate-in slide-in-from-top-2 duration-200">
          {children}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

interface TokenDataAccordionProps {
  tokenGraph: React.ReactNode;
  tokenInformation: React.ReactNode;
  defaultOpen?: boolean;
}

export function TokenDataAccordion({
  tokenGraph,
  tokenInformation,
  defaultOpen = true,
}: TokenDataAccordionProps) {
  return (
    <AccordionSection title="Token Analytics & Information" defaultOpen={defaultOpen}>
      {/* Token Graph */}
      <div className="bg-[#231f20]/50 rounded-xl overflow-hidden border border-[#D0B284]/10">
        {tokenGraph}
      </div>

      {/* Token Information */}
      <div className="bg-[#231f20]/50 rounded-xl overflow-hidden border border-[#D0B284]/10">
        {tokenInformation}
      </div>
    </AccordionSection>
  );
}
