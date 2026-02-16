# Knowledge Topology Visualization

**Created:** 2026-02-16
**Source:** v7.0 requirements discussion
**Priority:** Future milestone (v8.0+)

## Idea

A live, interactive visualization showing the entire shape of the data available in EverySkill — from raw data through organized information to intelligence.

## Layers

1. **Raw Data** — Individual skills, embeddings, metadata, usage events
2. **Organized Information** — Communities, entity relationships, similarity graphs, categories
3. **Intelligence** — Teaching/learning flows, LLM evaluation layer, benchmark insights, preference-driven recommendations

## Visualization Concept

- Graph view showing skills as nodes, communities as clusters, relationships as edges
- Zoom from macro (communities) → meso (skill groups) → micro (individual skills)
- Data flow animation: raw skill → embedding → community membership → search intelligence → user recommendation
- Live view reflecting actual database state (not static)
- Toggle layers: communities on/off, entities on/off, LLM layer on/off

## Technical Notes

- Could use D3.js force-directed graph or deck.gl for WebGL performance
- Reads from community tables (v7.0), embeddings, usage events
- Depends on community detection being built first
- Performance consideration: may need pre-computed graph layout for large datasets

## Value

- Makes the "smart database" claim tangible and visual
- Powerful demo/sales tool showing organizational knowledge structure
- Helps admins understand skill coverage gaps and knowledge density
