/**
 * Scene-graph nodes — the vocabulary of the unified canvas.
 *
 * The key design decision: vector-DESIGN primitives (frame/rect/text/path…) and
 * DIAGRAM primitives (shape/connector/sticky…) live in ONE node union, so a
 * board can hold both and tools operate on a single type. This is what makes the
 * canvas "equal parts Figma and OmniGraffle."
 *
 * Nodes reference the design system by token id (e.g. fill: {token: "color.brand"})
 * rather than hard-coded values wherever possible, so retheming the brand
 * updates every node that uses it.
 */

export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A paint is either a literal value or a reference into the design tokens. */
export type Paint =
  | { kind: "solid"; color: string }
  | { kind: "token"; token: string } // e.g. "color.brand.500"
  | { kind: "linear"; stops: Array<{ offset: number; color: string }>; angle: number }
  | { kind: "none" };

export interface Stroke {
  paint: Paint;
  width: number;
  /** connector/line ends, for diagram edges */
  dash?: number[];
}

/** Fields every node shares. */
export interface BaseNode {
  id: string;
  /** discriminant — see the union below */
  type: NodeType;
  name: string;
  /** transform in board space */
  frame: Rect;
  rotation?: number;
  opacity?: number;
  visible?: boolean;
  locked?: boolean;
  /** child node ids (containers: frame, group, component instance) */
  children?: string[];
  parentId?: string;
  /** if this node is an instance of a library component, its id */
  componentId?: string;
}

export type NodeType =
  // vector / UI design
  | "frame"
  | "group"
  | "rectangle"
  | "ellipse"
  | "text"
  | "path"
  | "image"
  | "instance" // an instance of a design-system component
  // diagramming
  | "shape" // a diagram shape (with ports for connectors)
  | "connector" // an edge between two nodes/ports
  | "sticky" // sticky note (ideas mapping / journeys)
  // map surfaces
  | "journeyStage" // a column in a UX journey map
  | "mindNode"; // a node in an ideas/mind map

// ── vector / UI nodes ────────────────────────────────────────────────────────

export interface FrameNode extends BaseNode {
  type: "frame";
  fills: Paint[];
  stroke?: Stroke;
  cornerRadius?: number;
  /** simple auto-layout, Figma-style (optional) */
  layout?: {
    direction: "horizontal" | "vertical";
    gap: number;
    padding: [number, number, number, number];
    align: "start" | "center" | "end";
  };
  clip?: boolean;
}

export interface RectangleNode extends BaseNode {
  type: "rectangle";
  fills: Paint[];
  stroke?: Stroke;
  cornerRadius?: number;
}

export interface EllipseNode extends BaseNode {
  type: "ellipse";
  fills: Paint[];
  stroke?: Stroke;
}

export interface TextNode extends BaseNode {
  type: "text";
  text: string;
  /** typography token id, or inline style */
  typographyToken?: string;
  style?: {
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    lineHeight: number;
    letterSpacing?: number;
    align?: "left" | "center" | "right";
  };
  fills: Paint[];
}

export interface PathNode extends BaseNode {
  type: "path";
  /** SVG path data (the common denominator across every importer) */
  d: string;
  fills: Paint[];
  stroke?: Stroke;
}

export interface ImageNode extends BaseNode {
  type: "image";
  /** asset ref (data URI or asset store key) */
  src: string;
  fit?: "cover" | "contain" | "fill";
}

export interface InstanceNode extends BaseNode {
  type: "instance";
  componentId: string;
  /** prop/override values applied to this instance */
  overrides?: Record<string, unknown>;
}

// ── diagram nodes ────────────────────────────────────────────────────────────

/** A diagram shape carries connection ports so connectors can snap to it. */
export interface ShapeNode extends BaseNode {
  type: "shape";
  /** built-in shape geometry keyword or a path */
  shape: "rect" | "roundRect" | "ellipse" | "diamond" | "cylinder" | "hexagon" | "cloud";
  fills: Paint[];
  stroke?: Stroke;
  label?: string;
  /** named ports; connectors reference {nodeId, portId} */
  ports?: Array<{ id: string; anchor: Vec2 }>; // anchor in 0..1 of the frame
}

export interface ConnectorEndpoint {
  nodeId: string;
  portId?: string;
  /** free endpoint if not attached to a node */
  point?: Vec2;
}

/** A smart connector — OmniGraffle-style auto-routing edge. */
export interface ConnectorNode extends BaseNode {
  type: "connector";
  from: ConnectorEndpoint;
  to: ConnectorEndpoint;
  routing: "straight" | "orthogonal" | "curved";
  stroke: Stroke;
  startArrow?: ArrowHead;
  endArrow?: ArrowHead;
  label?: string;
}

export type ArrowHead = "none" | "arrow" | "triangle" | "diamond" | "circle";

export interface StickyNode extends BaseNode {
  type: "sticky";
  text: string;
  fill: Paint;
}

// ── map-surface nodes ────────────────────────────────────────────────────────

export interface JourneyStageNode extends BaseNode {
  type: "journeyStage";
  title: string;
  /** rows of the journey column: actions, touchpoints, emotion (−1..1), pains */
  actions: string[];
  touchpoints: string[];
  emotion: number; // −1 (frustrated) .. 1 (delighted)
  pains: string[];
}

export interface MindNode extends BaseNode {
  type: "mindNode";
  text: string;
  /** collapsed subtree in the outline */
  collapsed?: boolean;
}

export type Node =
  | FrameNode
  | RectangleNode
  | EllipseNode
  | TextNode
  | PathNode
  | ImageNode
  | InstanceNode
  | ShapeNode
  | ConnectorNode
  | StickyNode
  | JourneyStageNode
  | MindNode;
