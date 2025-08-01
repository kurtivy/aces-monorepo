export interface Section {
  id: string;
  label: string;
  isModal?: boolean;
}

export interface SectionNavigationProps {
  sections: Section[];
  activeSection: number;
  onSectionChange: (index: number) => void;
  selectedImageIndex: number;
  setSelectedImageIndex: (index: number) => void;
  isAnimating: boolean;
  previousActiveSection: number | null;
}

export interface CardProps {
  section: Section;
  index: number;
  isActive: boolean;
  onSectionChange: (index: number) => void;
  selectedImageIndex: number;
  setSelectedImageIndex: (index: number) => void;
  isAnimating: boolean;
  previousActiveSection: number | null;
}

export interface ActiveSectionContentProps {
  sectionIndex: number;
  selectedImageIndex: number;
  setSelectedImageIndex: (index: number) => void;
}

export interface MiddleContentAreaProps {
  activeSection: number;
  selectedImageIndex: number;
  setSelectedImageIndex: (index: number) => void;
  navigationDirection: 'up' | 'down' | null;
}

export interface ImageData {
  id: number;
  src: string;
  thumbnail: string;
  alt: string;
}

export interface ModalProps {
  onClose: () => void;
}
