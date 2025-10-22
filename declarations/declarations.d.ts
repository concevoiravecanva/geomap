declare module "*.css" {
  const styles: { [className: string]: string };
  export = styles;
}

declare module "*.jpg" {
  const content: string;
  export default content;
}

declare module "*.jpeg" {
  const content: string;
  export default content;
}

declare module "*.png" {
  const content: string;
  export default content;
}

declare module "*.svg" {
  const content: React.FunctionComponent<{
    size?: "tiny" | "small" | "medium" | "large";
    className?: string;
  }>;
  export default content;
}

// Support importing SVGs as React components via resource query (?react)
declare module "*.svg?react" {
  const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  export default ReactComponent;
}

declare module "*.svg?url" {
  const url: string;
  export default url;
}

declare module "*.svg?data" {
  const dataUrl: string;
  export default dataUrl;
}

declare const BACKEND_HOST: string;
