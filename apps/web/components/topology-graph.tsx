"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  SigmaContainer,
  useLoadGraph,
  useRegisterEvents,
  useSigma,
  useSetSettings,
} from "@react-sigma/core";
import { useLayoutForceAtlas2 } from "@react-sigma/layout-forceatlas2";
import Graph from "graphology";
import "@react-sigma/core/lib/style.css";

import type { TopologyResponse, TopologyNode } from "@everyskill/db";
import { TopologyControls, type TopologyControlState } from "./topology-controls";
import { TopologyTooltip } from "./topology-tooltip";
import { TopologyLegend } from "./topology-legend";

export const COMMUNITY_COLORS = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#22c55e", // green
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#f97316", // orange
];

const CATEGORY_COLORS: Record<string, string> = {
  productivity: "#3b82f6",
  wiring: "#f59e0b",
  "doc-production": "#22c55e",
  "data-viz": "#8b5cf6",
  code: "#ef4444",
};

const UNCLUSTERED_COLOR = "#9ca3af";

/** Mix a hex color toward gray to create a muted version */
function dimColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Blend 60% toward #d1d5db (gray-300) — visible but clearly subdued
  const mix = (c: number, t: number) => Math.round(c + (t - c) * 0.6);
  return `#${mix(r, 209).toString(16).padStart(2, "0")}${mix(g, 213).toString(16).padStart(2, "0")}${mix(b, 219).toString(16).padStart(2, "0")}`;
}

function nodeColor(
  node: TopologyNode,
  colorByCommunity: boolean,
  communityIndexMap: Map<number, number>
): string {
  if (colorByCommunity) {
    if (node.communityId == null) return UNCLUSTERED_COLOR;
    const idx = communityIndexMap.get(node.communityId) ?? 0;
    return COMMUNITY_COLORS[idx % COMMUNITY_COLORS.length];
  }
  return CATEGORY_COLORS[node.category] ?? UNCLUSTERED_COLOR;
}

function nodeSize(node: TopologyNode, sizeByUsage: boolean): number {
  if (!sizeByUsage) return 8;
  return Math.max(5, Math.log2(node.totalUses + 1) * 5);
}

// Inner component that uses sigma hooks (must be child of SigmaContainer)
function GraphLoader({
  data,
  controls,
  onHover,
  onClick,
}: {
  data: TopologyResponse;
  controls: TopologyControlState;
  onHover: (node: TopologyNode | null, x: number, y: number) => void;
  onClick: (slug: string) => void;
}) {
  const loadGraph = useLoadGraph();
  const registerEvents = useRegisterEvents();
  const sigma = useSigma();
  const setSettings = useSetSettings();
  const { assign } = useLayoutForceAtlas2({
    iterations: 100,
    settings: {
      gravity: 1,
      scalingRatio: 10,
      barnesHutOptimize: true,
    },
  });

  // Build a stable map from communityId to sorted index
  const communityIndexMap = useRef(new Map<number, number>());

  // Load graph once on mount or when data changes
  useEffect(() => {
    const graph = new Graph({ type: "undirected" });

    // Build community index map (sorted by member count desc for consistent coloring)
    const indexMap = new Map<number, number>();
    data.communities.forEach((c, i) => indexMap.set(c.communityId, i));
    communityIndexMap.current = indexMap;

    // Add nodes
    for (const node of data.nodes) {
      graph.addNode(node.id, {
        label: node.name,
        size: nodeSize(node, controls.sizeByUsage),
        color: nodeColor(node, controls.colorByCommunity, indexMap),
        x: Math.random() * 100,
        y: Math.random() * 100,
        // Store metadata for hover/click
        nodeData: node,
      });
    }

    // Add edges
    for (const edge of data.edges) {
      if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
        try {
          graph.addEdge(edge.source, edge.target, {
            size: 0.5 + ((edge.similarity - 0.3) / 0.7) * 2.5,
            color: "#d1d5db",
            similarity: edge.similarity,
          });
        } catch {
          // Skip duplicate edges
        }
      }
    }

    loadGraph(graph);
    // Run layout after graph is loaded
    assign();
  }, [data]);

  // Update visual encoding when controls change
  useEffect(() => {
    const graph = sigma.getGraph();
    const indexMap = communityIndexMap.current;
    const highlightMine = controls.highlightMine;

    graph.forEachNode((nodeId, attrs) => {
      const nd = attrs.nodeData as TopologyNode | undefined;
      if (!nd) return;

      const baseColor = nodeColor(nd, controls.colorByCommunity, indexMap);
      const isUserNode = nd.authored || nd.used;

      // When highlighting user skills, mute non-user nodes (keep tint, reduce saturation)
      if (highlightMine && !isUserNode) {
        graph.setNodeAttribute(nodeId, "color", dimColor(baseColor));
      } else {
        graph.setNodeAttribute(nodeId, "color", baseColor);
      }

      graph.setNodeAttribute(nodeId, "size", nodeSize(nd, controls.sizeByUsage));

      // Focus community: hide nodes not in focused community
      if (controls.focusCommunity != null) {
        const inFocus = nd.communityId === controls.focusCommunity;
        graph.setNodeAttribute(nodeId, "hidden", !inFocus);
      } else {
        graph.setNodeAttribute(nodeId, "hidden", false);
      }
    });

    // Hide/show edges based on focus
    graph.forEachEdge((edgeId, _attrs, source, target) => {
      if (controls.focusCommunity != null) {
        const srcData = graph.getNodeAttribute(source, "nodeData") as TopologyNode | undefined;
        const tgtData = graph.getNodeAttribute(target, "nodeData") as TopologyNode | undefined;
        const inFocus =
          srcData?.communityId === controls.focusCommunity &&
          tgtData?.communityId === controls.focusCommunity;
        graph.setEdgeAttribute(edgeId, "hidden", !inFocus);
      } else {
        graph.setEdgeAttribute(edgeId, "hidden", false);
      }
    });
  }, [
    controls.colorByCommunity,
    controls.sizeByUsage,
    controls.focusCommunity,
    controls.highlightMine,
    sigma,
  ]);

  // nodeReducer: draw permanent highlight ring on user's skills
  useEffect(() => {
    setSettings({
      renderEdgeLabels: false,
      nodeReducer: (_node, data) => {
        const nd = data.nodeData as TopologyNode | undefined;
        if (!nd) return data;
        const isUserNode = nd.authored || nd.used;
        return {
          ...data,
          // highlighted = true draws a permanent hover-like ring
          highlighted: isUserNode,
          // Authored skills always show their label
          forceLabel: nd.authored,
          zIndex: isUserNode ? 1 : 0,
        };
      },
      edgeReducer: controls.showEdges ? null : (_edge, data) => ({ ...data, hidden: true }),
    });
  }, [controls.showEdges, setSettings]);

  // Register interaction events
  useEffect(() => {
    registerEvents({
      enterNode: (event) => {
        const graph = sigma.getGraph();
        const nd = graph.getNodeAttribute(event.node, "nodeData") as TopologyNode | undefined;
        if (!nd) return;
        const coords = sigma.graphToViewport({
          x: graph.getNodeAttribute(event.node, "x"),
          y: graph.getNodeAttribute(event.node, "y"),
        });
        onHover(nd, coords.x, coords.y);

        // Highlight connected edges
        graph.forEachEdge(event.node, (edgeId) => {
          graph.setEdgeAttribute(edgeId, "color", "#6b7280");
          graph.setEdgeAttribute(
            edgeId,
            "size",
            (((graph.getEdgeAttribute(edgeId, "similarity") as number) - 0.3) / 0.7) * 3 + 1
          );
        });
      },
      leaveNode: () => {
        onHover(null, 0, 0);
        // Reset edge highlighting
        const graph = sigma.getGraph();
        graph.forEachEdge((edgeId) => {
          graph.setEdgeAttribute(edgeId, "color", "#d1d5db");
          const sim = graph.getEdgeAttribute(edgeId, "similarity") as number;
          graph.setEdgeAttribute(edgeId, "size", 0.5 + ((sim - 0.3) / 0.7) * 2.5);
        });
      },
      clickNode: (event) => {
        const graph = sigma.getGraph();
        const nd = graph.getNodeAttribute(event.node, "nodeData") as TopologyNode | undefined;
        if (nd) onClick(nd.slug);
      },
    });
  }, [registerEvents, sigma, onHover, onClick]);

  return null;
}

export function TopologyGraph() {
  const router = useRouter();
  const [data, setData] = useState<TopologyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<TopologyNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [controls, setControls] = useState<TopologyControlState>({
    showEdges: true,
    sizeByUsage: true,
    colorByCommunity: true,
    highlightMine: true,
    focusCommunity: null,
  });

  useEffect(() => {
    fetch("/api/topology")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load topology (${r.status})`);
        return r.json();
      })
      .then((d: TopologyResponse) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Unknown error");
        setLoading(false);
      });
  }, []);

  const handleHover = useCallback((node: TopologyNode | null, x: number, y: number) => {
    setHoveredNode(node);
    setTooltipPos({ x, y });
  }, []);

  const handleClick = useCallback(
    (slug: string) => {
      router.push(`/skills/${slug}`);
    },
    [router]
  );

  const userStats = useMemo(() => {
    if (!data) return { authored: 0, used: 0 };
    return {
      authored: data.nodes.filter((n) => n.authored).length,
      used: data.nodes.filter((n) => n.used && !n.authored).length,
    };
  }, [data]);

  if (loading) {
    return (
      <div className="flex h-[500px] items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
        <div className="text-sm text-gray-500">Loading knowledge topology...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[500px] items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
        <div className="text-sm text-red-500">{error}</div>
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="flex h-[500px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
        <p className="text-sm text-gray-500">
          No skills with embeddings found. Publish skills to see the knowledge topology.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-[500px] overflow-hidden rounded-lg border border-gray-200 bg-white">
      <SigmaContainer
        style={{ width: "100%", height: "100%" }}
        settings={{
          defaultEdgeColor: "#d1d5db",
          labelColor: { color: "#374151" },
          labelSize: 12,
          labelRenderedSizeThreshold: 12,
          defaultNodeType: "circle",
          minEdgeThickness: 0.5,
          zIndex: true,
        }}
      >
        <GraphLoader data={data} controls={controls} onHover={handleHover} onClick={handleClick} />
      </SigmaContainer>
      <TopologyControls state={controls} onChange={setControls} communities={data.communities} />
      <TopologyLegend
        communities={data.communities}
        colorByCommunity={controls.colorByCommunity}
        userStats={userStats}
      />
      <TopologyTooltip node={hoveredNode} x={tooltipPos.x} y={tooltipPos.y} />
      <div className="absolute bottom-3 right-3 z-10 text-[10px] text-gray-400">
        {data.stats.nodeCount} skills &middot; {data.stats.edgeCount} edges &middot;{" "}
        {data.stats.communityCount} communities
      </div>
    </div>
  );
}
