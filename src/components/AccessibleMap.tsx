import React, { useCallback, useMemo, useRef, useState } from "react";
import { Button, Columns, Column, Rows, Text } from "@canva/app-ui-kit";
import { upload } from "@canva/asset";
import { useAddElement } from "utils/use_add_element";
import WorldSvg from "src/assets/world.svg?react";
import worldDataUrl from "src/assets/world.svg?data";
import { useIntl, FormattedMessage } from "react-intl";

type Marker = { id: string; x: number; y: number; name: string };

// Visually hidden style for screen reader announcements
const srOnly: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

export const AccessibleMap: React.FC = () => {
  const intl = useIntl();
  const addElement = useAddElement();
  const containerRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number } | null>(null);
  const [ariaMessage, setAriaMessage] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [safeMode] = useState(true); // render as <img> to avoid sandbox SVG issues

  // Announce zoom changes
  const handleZoomIn = () => {
    setZoom((z) => {
      const nz = Math.min(5, z * 1.2);
      setAriaMessage("Zoom avant");
      return nz;
    });
  };
  const handleZoomOut = () => {
    setZoom((z) => {
      const nz = Math.max(0.2, z / 1.2);
      setAriaMessage("Zoom arrière");
      return nz;
    });
  };

  // Keyboard panning
  const onKeyDownContainer = (e: React.KeyboardEvent) => {
    const step = 20;
    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      handleZoomIn();
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      handleZoomOut();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setPan((p) => ({ x: p.x + step, y: p.y }));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setPan((p) => ({ x: p.x - step, y: p.y }));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setPan((p) => ({ x: p.x, y: p.y + step }));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setPan((p) => ({ x: p.x, y: p.y - step }));
    }
  };

  // Mouse panning
  const onMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || !panStart.current) return;
    setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
  };
  const onMouseUp = () => {
    setIsPanning(false);
    panStart.current = null;
  };
  const onMouseLeave = () => {
    setIsPanning(false);
    panStart.current = null;
  };

  // Wheel zoom around cursor position
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const scaleFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const newZoom = Math.min(5, Math.max(0.2, zoom * scaleFactor));
    const k = newZoom / zoom;

    // Adjust pan so the world point under the cursor stays under the cursor after zoom
    setPan((p) => ({
      x: cursorX - k * (cursorX - p.x),
      y: cursorY - k * (cursorY - p.y),
    }));
    setZoom(newZoom);
    setAriaMessage(e.deltaY < 0 ? "Zoom avant" : "Zoom arrière");
  };

  // Handle selecting a region (country)
  const handleSelect = useCallback((name: string) => {
    setSelectedRegion(name);
    setAriaMessage(`${name} sélectionné`);
  }, []);

  // Add a marker at the current view center
  const addMarkerAtCenter = () => {
    if (safeMode) {
      // Approximate intrinsic coords; use image natural size once loaded
      const id = `m-${Date.now()}`;
      const name = `Marqueur ${markers.length + 1}`;
      // Use nominal 800x400 like our viewBox as prototype
      const x = 800 / 2;
      const y = 400 / 2;
      setMarkers((m) => [...m, { id, x, y, name }]);
      setAriaMessage(`${name} ajouté`);
      return;
    }
    const svg = containerRef.current?.querySelector("svg");
    if (!svg) return;
    const vb = (svg as SVGSVGElement).viewBox.baseVal;
    const id = `m-${Date.now()}`;
    const name = `Marqueur ${markers.length + 1}`;
    // Center in viewBox space; pan/zoom are visual, markers live in intrinsic coords
    const x = vb.x + vb.width / 2;
    const y = vb.y + vb.height / 2;
    setMarkers((m) => [...m, { id, x, y, name }]);
    setAriaMessage(`${name} ajouté`);
  };

  // Export current view as PNG and add to design
  const addCurrentViewToDesign = async () => {
    const container = containerRef.current;
    const { width, height } = container?.getBoundingClientRect() || { width: 800, height: 500 };

    let dataUrl: string;
    if (safeMode) {
      // Draw world.svg <img> to canvas with current pan/zoom
      dataUrl = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(width);
            canvas.height = Math.round(height);
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("Canvas not supported");
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.translate(pan.x, pan.y);
            ctx.scale(zoom, zoom);
            ctx.drawImage(img, 0, 0, 800, 400); // use nominal intrinsic size
            ctx.restore();
            resolve(canvas.toDataURL("image/png", 1.0));
          } catch (e) {
            reject(e);
          }
        };
        img.onerror = reject;
  img.src = worldDataUrl as unknown as string;
      });
    } else {
      // Fallback to SVG serialization path
      const svg = container?.querySelector("svg");
      if (!svg) return;
      const clone = (svg as SVGSVGElement).cloneNode(true) as SVGSVGElement;
      clone.setAttribute("width", String(width));
      clone.setAttribute("height", String(height));
      const svgData = new XMLSerializer().serializeToString(clone);
      const blob = new Blob([svgData], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      dataUrl = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(width);
            canvas.height = Math.round(height);
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("Canvas not supported");
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/png", 1.0));
          } catch (err) {
            reject(err);
          } finally {
            URL.revokeObjectURL(url);
          }
        };
        img.onerror = reject;
        img.src = url;
      });
    }

    // Upload and add to design
    const { ref } = await upload({
      type: "image",
      mimeType: "image/png",
      url: dataUrl,
      thumbnailUrl: dataUrl,
      aiDisclosure: "none",
    });

    await addElement({
      type: "image",
      ref,
      altText: { text: intl.formatMessage({ defaultMessage: "Carte exportée", description: "Alt text for exported map image" }), decorative: undefined },
    });
    setAriaMessage("Carte ajoutée au design");
  };

  // Recursively augment the rendered SVG with accessibility and interactivity
  type AnyProps = Record<string, unknown> & { children?: React.ReactNode };

  const augment = useCallback(
    (el: React.ReactNode): React.ReactNode => {
      if (!React.isValidElement(el)) return el;

      const element = el as React.ReactElement;
      const typeValue = element.type;
      const isStringType = typeof typeValue === "string";
      const tagName = isStringType ? (typeValue as string).toLowerCase() : "";

      const attrs: AnyProps = { ...(element.props as AnyProps) };
      let children = attrs.children as React.ReactNode;

      // Recurse first
      if (children) {
        children = React.Children.map(children, (c) => augment(c));
      }

      // Add marker layer at the end of the root <svg>
      const isSvgRoot = tagName === "svg";
      if (isSvgRoot) {
        // Do not modify the SVG root attributes to avoid sandbox issues.
        // Only wrap its children in a transformed <g> for pan/zoom and add markers.

        const markerNodes = markers.map((m) => (
          <circle
            key={m.id}
            cx={m.x}
            cy={m.y}
            r={6}
            fill="#E53935"
            stroke="#fff"
            strokeWidth={2}
            onClick={(e) => {
              e.stopPropagation();
              setAriaMessage(`Point ${m.name}`);
            }}
          >
            <title>{intl.formatMessage({ defaultMessage: "Point {name}", description: "Marker aria label" }, { name: m.name })}</title>
          </circle>
        ));
  children = (
          <g id="viewport" transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
            {children}
            <g id="markers">{markerNodes}</g>
          </g>
        );
      }

      // Make each path focusable and clickable
      const isPath = tagName === "path";
      if (isPath) {
  const pathAttrs = attrs as unknown as (React.SVGProps<SVGPathElement> & AnyProps & {
          id?: string;
          onClick?: React.MouseEventHandler<SVGPathElement>;
          onKeyDown?: React.KeyboardEventHandler<SVGPathElement>;
  } & Record<string, unknown>);

        const dataName = (pathAttrs["data-name"] as string | undefined) || undefined;
  const name: string = dataName || pathAttrs.id || intl.formatMessage({ defaultMessage: "Région", description: "Fallback region name" });
  const onClickPrev = pathAttrs.onClick;
  pathAttrs.onClick = (e: React.MouseEvent<SVGPathElement>) => {
          e.stopPropagation();
          handleSelect(name);
          onClickPrev?.(e);
        };
  pathAttrs.onMouseEnter = (e: React.MouseEvent<SVGPathElement>) => {
          (e.currentTarget as SVGPathElement).style.filter = "brightness(0.9)";
        };
  pathAttrs.onMouseLeave = (e: React.MouseEvent<SVGPathElement>) => {
          (e.currentTarget as SVGPathElement).style.filter = "";
        };
        // Add <title> for accessible name
        children = (
          <>
            <title>{name}</title>
            {children}
          </>
        );
      }

      return React.cloneElement(element, attrs, children as React.ReactNode);
    },
    [zoom, pan, isPanning, markers, handleSelect, intl],
  );

  const augmentedWorld = useMemo(() => augment(<WorldSvg />), [augment]);

  // Error boundary to gracefully fallback if sandbox rejects something
  class SvgBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
    constructor(props: { children: React.ReactNode }) {
      super(props);
      this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
      return { hasError: true };
    }
  override componentDidCatch(err: unknown) {
      // Intentionally quiet – Canva console shows errors; this prevents hard-crash
      // console.error("SVG render error", err);
    }
  override render() {
      if (this.state.hasError) {
        return <WorldSvg />;
      }
      return <>{this.props.children}</>;
    }
  }

  return (
    <div>
      <Rows spacing="1.5u">
        <Text>
          <FormattedMessage defaultMessage="Carte interactive (accessible)" description="Heading for accessible map" />
        </Text>

        <Columns spacing="1u" alignY="center">
          <Column width="content">
            <Button onClick={addMarkerAtCenter} variant="secondary">
              {intl.formatMessage({ defaultMessage: "Ajouter un marqueur (centre)", description: "Add marker at center" })}
            </Button>
          </Column>
        </Columns>

        <div
          ref={containerRef}
          tabIndex={0}
          onKeyDown={onKeyDownContainer}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          onWheel={onWheel}
          role="region"
          aria-label={intl.formatMessage({ defaultMessage: "Carte interactive", description: "Accessible map container label" })}
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            overflow: "hidden",
            width: "100%",
            height: 300,
            position: "relative",
            outline: "none",
            userSelect: "none",
            cursor: isPanning ? "grabbing" : "grab",
          }}
        >
          {/* Live region for announcements */}
          <div aria-live="polite" style={srOnly}>
            {ariaMessage}
          </div>
          {/* Render map (safe mode uses <img>) */}
          <div style={{ width: "100%", height: "100%", position: "relative" }}>
            {safeMode ? (
        <div
                aria-hidden
                style={{
                  width: 800,
                  height: 400,
          backgroundImage: `url(${worldDataUrl})`,
                  backgroundRepeat: "no-repeat",
                  backgroundSize: "contain",
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: "0 0",
                }}
              />
            ) : (
              <SvgBoundary>{augmentedWorld}</SvgBoundary>
            )}
          </div>
        </div>

        <Button onClick={addCurrentViewToDesign} variant="primary">
          {intl.formatMessage({ defaultMessage: "Ajouter la carte au design", description: "Add map image to design" })}
        </Button>

        {selectedRegion && (
          <Text>
            <FormattedMessage defaultMessage="Région sélectionnée: {name}" description="Selected region label" values={{ name: selectedRegion }} />
          </Text>
        )}
      </Rows>
    </div>
  );
};

export default AccessibleMap;
