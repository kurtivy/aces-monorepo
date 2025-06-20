# 📈 Mobile Canvas Performance + Infinite Scroll Plan

## ✅ Objectives

- **Scalable 60fps performance** across all platforms (mobile, desktop, ultra-wide, 4K)
- Efficient infinite tiling using 24 images + Create Token **without performance degradation at any scale**
- Zero regressions or console errors from optimizations
- Adheres to diagnostic validation rules from Phases 1 & 2
- Maintains current bundle size (~41.7kB) with **target ceiling <45kB uncompressed**

---

## 🔍 Diagnosed Bottlenecks

Based on codebase analysis, I've identified these performance bottlenecks:

### **Canvas Animation Performance Issues (All Platforms):**

1. **Canvas redraw overhead**: Every frame triggers full canvas clear + full grid redraw (60fps × full grid = excessive GPU load **even on desktop**)
2. **Adaptive frame management limitations**: Current system only reduces quality, doesn't optimize redraw scope or culling
3. **Hit detection during animation**: Mouse/touch position checks run every frame even during pure animation (no interaction)
4. **Gradient cache memory pressure**: **All devices** hit cache limits during complex animations as grid scales
5. **Space animation conflicts**: Background space animation + main canvas animation compete for GPU resources **universally**

### **Infinite Grid Scaling Issues:**

1. **Batch processing bottleneck**: Current 4-tile batch processing creates stuttering during fast pan/zoom
2. **Grid memory accumulation**: `repeatedPlacements` and `repeatedTokens` Maps grow unbounded during exploration
3. **Viewport calculation overhead**: 2.5x buffer zone causes excessive off-screen tile generation
4. **Placement algorithm complexity**: O(n²) nested loops for large grid areas during tile generation
5. **Grid bounds validation**: Every mouse interaction validates against all repeated tiles (performance scales with exploration distance)

---

## 🛠️ Proposed Solutions

### Solution 1: Viewport-Aware Partial Canvas Redraw

- **Summary:** Only redraw canvas regions that changed, not the entire canvas every frame
- **How it works:**
  - Track "dirty regions" during pan/zoom/hover interactions
  - Use `ctx.save()` + `ctx.clip()` to redraw only changed rectangular areas
  - Maintain "clean canvas state" cache for unchanged regions
  - Skip entire draw cycle when viewport is static (no animation/interaction)
- **Safety Check:** No complexity increase - uses existing canvas APIs with simple rectangular math
- **Validation Plan:**
  - [ ] Build and type checks pass
  - [ ] Console clean on mobile browsers
  - [ ] Mobile frame rate improves from ~45fps to 60fps
  - [ ] Memory usage stable or reduced
  - [ ] No visual artifacts during partial redraws

### Solution 2: Smart Grid Tile Streaming

- **Summary:** Stream tiles in viewport-priority order instead of batch processing
- **How it works:**
  - Calculate tile priority: center tiles first, edge tiles last
  - Use `requestIdleCallback()` for background tile generation
  - Implement LRU cache with configurable mobile memory limits (25-50 tiles max)
  - Async tile generation prevents blocking main animation thread
- **Safety Check:** Follows existing tile generation patterns, just adds priority queue and memory management
- **Validation Plan:**
  - [ ] Build and type checks pass
  - [ ] Smooth panning during tile generation (no stuttering)
  - [ ] Memory usage caps at mobile-appropriate levels
  - [ ] Infinite scrolling in all directions without performance degradation

### Solution 3: Animation-Aware Frame Scheduling

- **Summary:** Separate animation scheduling for background vs interactive elements
- **How it works:**
  - Split animation loops: UI animations (60fps), background effects (30fps), idle optimizations (15fps)
  - Use `performance.now()` timestamps to skip background animations during interaction
  - Mobile-specific: disable background animations entirely during touch tracking
  - Restore full fidelity 500ms after interaction ends
- **Safety Check:** Builds on existing mobile detection - no new browser-specific code
- **Validation Plan:**
  - [ ] Build and type checks pass
  - [ ] Touch tracking feels 1:1 responsive (Google Maps quality)
  - [ ] Background animations don't interfere with touch performance
  - [ ] Frame rate stable at 60fps during interaction, adaptive when idle

### Solution 4: Memory-Optimized Image Reuse Pool

- **Summary:** Pre-allocate image draw contexts and reuse instead of creating new ones
- **How it works:**
  - Create 5-10 reusable `ImageData` buffers for common sizes (unitSize, unitSize\*2, etc.)
  - Cache rendered image compositions (image + effects) in reusable buffers
  - Use object pooling pattern - acquire/release buffers instead of create/destroy
  - **Tree-shakeable utility module** with device-tier appropriate pool sizing based on available memory
- **Safety Check:** Pure optimization - doesn't change rendering output, just reduces allocations
- **Validation Plan:**
  - [ ] Build and type checks pass
  - [ ] Mobile memory usage decreases by 10-20%
  - [ ] No visual differences in image rendering
  - [ ] GC pressure reduced (fewer allocation spikes)

### Solution 5: Intersection Observer Grid Management

- **Summary:** Use modern browser APIs to automatically manage visible tile lifecycle
- **How it works:**
  - Create virtual "tile observer" elements positioned at grid boundaries
  - `IntersectionObserver` automatically detects when tiles enter/exit viewport
  - Leverages browser's optimized visibility detection instead of manual viewport math
  - Automatic cleanup of distant tiles when they become unobservable
- **Safety Check:** Progressive enhancement - **fallback is existing manual viewport math in `calculateRequiredTiles()`**
- **Validation Plan:**
  - [ ] Build and type checks pass
  - [ ] Automatic tile cleanup reduces memory growth
  - [ ] Performance improves (browser-native vs manual visibility detection)
  - [ ] Fallback works on older mobile browsers

---

## 🧪 Metrics Template (to complete after implementation)

| Metric                     | Before     | After      | Change |
| -------------------------- | ---------- | ---------- | ------ |
| **Mobile Frame Rate**      | ~45 fps    | XX fps     | XX% ↑  |
| **Desktop Frame Rate**     | ~60 fps    | XX fps     | XX% ↑  |
| **Ultra-wide Performance** | Unknown    | XX fps     | New    |
| Memory Usage (peak)        | ~85 MB     | XX MB      | XX% ↓  |
| Bundle Size                | 41.7 kB    | XX kB      | XX% ↑↓ |
| Console Errors             | 0          | XX         | 100% ↓ |
| Load Time                  | ~3.2s      | XX ms      | XX% ↑↓ |
| Grid Tile Load Time        | ~150ms     | XX ms      | XX% ↓  |
| Touch Response Latency     | ~32ms      | XX ms      | XX% ↓  |
| **Desktop Scaling Limit**  | ~5 screens | XX screens | XX% ↑  |
| Memory Growth Rate         | ~2MB/min   | XX MB/min  | XX% ↓  |

### **Performance Validation Checklist:**

**Cross-Platform Performance Testing:**

- [ ] **Mobile:** Safari iOS, Chrome Android, Safari iPad - 60fps at mobile scales
- [ ] **Desktop:** Chrome, Firefox, Safari desktop - 60fps up to 20+ screen distances
- [ ] **Ultra-wide:** 3440×1440+ displays - no performance degradation from viewport size
- [ ] **4K displays:** 4K resolution - maintains performance with high pixel density
- [ ] **Low-end hardware:** Integrated graphics, older laptops - graceful degradation

**Memory & CPU Monitoring:**

- [ ] Memory usage caps at device-appropriate levels (50-100MB mobile)
- [ ] No memory leaks during extended infinite scrolling sessions
- [ ] CPU usage under 30% during active interaction
- [ ] Battery impact minimal (no excessive background processing)

**Visual Quality Validation:**

- [ ] No visual artifacts from partial redraw optimization
- [ ] Image quality maintained across all zoom levels
- [ ] Animation smoothness preserved (no stuttering or dropped frames)
- [ ] Grid tile boundaries seamless (no gaps or overlaps)

---

## 🧭 Implementation Strategy

**Phase 3.1: Partial Canvas Redraw (Solution 1)** ⭐ _Highest ROI, lowest complexity_

- **Why first:** Immediate visible 60fps benefit with simple rectangular math, no architectural changes
- Implement dirty region tracking
- Add clip-based redraw optimization
- Test on mobile Safari first (highest performance impact)
- Rollback trigger: Any visual artifacts or performance regression
- 🚫 **Code Smell Warning:** Avoid `if (isMobile)` conditionals - use device capability detection instead

**Phase 3.2: Grid Tile Streaming (Solution 2)** _Enables true infinite scrolling_

- **Why second:** Builds foundation for unlimited exploration, moderate complexity
- Replace batch processing with priority queue
- Implement LRU cache with mobile memory limits (**tree-shakeable module**)
- Add `requestIdleCallback` for background processing
- Rollback trigger: Stuttering during pan/zoom or memory leaks
- 🚫 **Code Smell Warning:** Keep tile generation device-agnostic, use memory pressure detection

**Phase 3.3: Frame Scheduling (Solution 3)** _Leverages 3.1 foundation_

- **Why third:** Builds on partial redraw system, optimizes animation coordination
- Split animation loops: UI animations (60fps), background effects (30fps), idle optimizations (15fps)
- Add interaction-aware background animation disabling
- Optimize mobile touch response timing
- Rollback trigger: Touch tracking feels sluggish or unresponsive
- 🚫 **Code Smell Warning:** Use performance timing, not browser detection for frame scheduling

**Phase 3.4: Image Pool Optimization (Solution 4)** _Independent memory optimization_

- **Why fourth:** Can be implemented anytime, pure optimization with no dependencies
- Create reusable ImageData buffer pool (**tree-shakeable utility**)
- Implement acquire/release pattern for image rendering
- Add device-tier appropriate pool sizing
- Rollback trigger: Visual differences or increased memory usage
- 🚫 **Code Smell Warning:** Pool size based on available memory, not device type assumptions

**Phase 3.5: Intersection Observer (Solution 5)** _Most complex, requires extensive testing_

- **Why last:** Requires comprehensive fallback testing, highest implementation risk
- Add tile lifecycle management via IntersectionObserver
- **Fallback:** Existing manual viewport math in `calculateRequiredTiles()` when IntersectionObserver unsupported
- Test browser compatibility across mobile targets
- Rollback trigger: Tile cleanup failures or browser compatibility issues
- 🚫 **Code Smell Warning:** Progressive enhancement only - never assume IntersectionObserver availability

---

## 🧭 Next Step

**Ready for human review before implementation.**

This plan follows all diagnostic validation requirements:

- ✅ **Baseline established**: Current bundle 41.7kB, ~45fps mobile, ~85MB memory
- ✅ **Complexity control**: Each solution builds on existing patterns, no architectural changes
- ✅ **Rollback strategy**: Clear triggers and revert procedures for each phase
- ✅ **Performance focus**: All optimizations target measured bottlenecks, not theoretical issues
- ✅ **Mobile priority**: Solutions prioritized by mobile performance impact
- ✅ **Validation framework**: Comprehensive testing checklist covering functionality, performance, compatibility

**The goal is smooth 60fps mobile performance + unlimited infinite scrolling while maintaining the existing stability and simplicity achieved in Phases 1 & 2.**
