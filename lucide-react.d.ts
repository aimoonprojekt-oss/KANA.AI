declare module 'lucide-react' {
  import * as React from 'react';
  interface IconProps {
    size?: number | string;
    color?: string;
    strokeWidth?: number | string;
    className?: string;
    style?: React.CSSProperties;
    [key: string]: unknown;
  }
  type Icon = React.FC<IconProps>;

  export const Search: Icon;
  export const Scissors: Icon;
  export const Send: Icon;
  export const Lightbulb: Icon;
  export const Gem: Icon;
  export const Plus: Icon;
  export const ArrowRight: Icon;
  export const CheckCircle: Icon;
  export const LayoutGrid: Icon;
  export const FileText: Icon;
  export const Inbox: Icon;
  export const Megaphone: Icon;
  export const Briefcase: Icon;
  export const Package: Icon;
  export const Settings2: Icon;
  export const ShoppingCart: Icon;
  export const Clock: Icon;
  export const SlidersHorizontal: Icon;
  export const LogOut: Icon;
  export const Play: Icon;
  export const Lock: Icon;
  export const CreditCard: Icon;
  export const Activity: Icon;
  export const X: Icon;
  export const Monitor: Icon;
  export const Mail: Icon;
}
