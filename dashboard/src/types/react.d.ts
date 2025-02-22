import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react';

declare module 'react' {
  interface ReactElement {
    type: ForwardRefExoticComponent<any> | string | ((props: any) => ReactNode);
  }
}

declare module 'lucide-react' {
  type Icon = ForwardRefExoticComponent<Omit<SVGProps<SVGSVGElement>, "ref"> & RefAttributes<SVGSVGElement>>;
  
  export const Mail: Icon;
  export const Lock: Icon;
  export const Loader2: Icon;
  // Add other icons as needed
} 