import { useMemo } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import type { PropsWithChildren } from 'react';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface InfiniteCanvasProps extends PropsWithChildren {
  /** Minimum content width (default: screen width * 2) */
  minWidth?: number;
  /** Minimum content height (default: screen height * 2) */
  minHeight?: number;
  /** Padding around content to allow panning (default: screen width/height) */
  padding?: number;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 3.0;
const INITIAL_SCALE = 1.0;

/**
 * InfiniteCanvas Component
 * 
 * Provides a pan-able and zoom-able infinite canvas similar to OneNote.
 * Features:
 * - Smooth pan gestures with Reanimated
 * - Pinch-to-zoom gesture support
 * - Boundary constraints (prevents scrolling into void)
 * - Main content (ego) stays centered initially
 * - Native performance with worklets
 */
export function InfiniteCanvas({
  children,
  minWidth = SCREEN_WIDTH * 2,
  minHeight = SCREEN_HEIGHT * 2,
  padding = Math.max(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.5,
}: InfiniteCanvasProps) {
  // Pan position (translation) - start centered
  // Initial position centers the content in the viewport
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  // Zoom scale
  const scale = useSharedValue(INITIAL_SCALE);
  const savedScale = useSharedValue(INITIAL_SCALE);

  // Calculate content bounds
  const contentBounds = useMemo(() => {
    // Content area: ensure it's at least screen size + generous padding
    const contentWidth = Math.max(minWidth, SCREEN_WIDTH + padding * 2);
    const contentHeight = Math.max(minHeight, SCREEN_HEIGHT + padding * 2);
    
    // Translation bounds: allow panning within padding area
    // This ensures main content (ego) stays visible
    // Content starts at (0,0), can pan within ±padding
    const panRange = padding;
    const maxTranslateX = panRange;
    const minTranslateX = -panRange;
    const maxTranslateY = panRange;
    const minTranslateY = -panRange;

    return {
      contentWidth,
      contentHeight,
      minTranslateX,
      maxTranslateX,
      minTranslateY,
      maxTranslateY,
    };
  }, [minWidth, minHeight, padding]);

  // Clamp translation to bounds based on current scale
  const clampTranslation = (x: number, y: number, currentScale: number) => {
    'worklet';
    // When zoomed in, allow more panning range
    // Calculate bounds based on scaled content size
    const scaledContentWidth = contentBounds.contentWidth * currentScale;
    const scaledContentHeight = contentBounds.contentHeight * currentScale;
    
    // Maximum translation is half the difference between scaled content and screen
    const maxX = Math.max(0, (scaledContentWidth - SCREEN_WIDTH) / 2);
    const maxY = Math.max(0, (scaledContentHeight - SCREEN_HEIGHT) / 2);
    
    const clampedX = Math.max(-maxX, Math.min(maxX, x));
    const clampedY = Math.max(-maxY, Math.min(maxY, y));
    
    return { x: clampedX, y: clampedY };
  };

  // Clamp scale to min/max bounds
  const clampScale = (s: number) => {
    'worklet';
    return Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));
  };

  // Track starting position when gesture begins
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);

  // Pinch gesture for zoom
  const pinchGesture = Gesture.Pinch()
    .onStart((e) => {
      // Store focal point relative to screen center
      focalX.value = e.focalX - SCREEN_WIDTH / 2;
      focalY.value = e.focalY - SCREEN_HEIGHT / 2;
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      const newScale = clampScale(savedScale.value * e.scale);
      const scaleChange = newScale / savedScale.value;
      
      // Adjust translation so the focal point stays in place during zoom
      // This creates a natural zoom-towards-fingers effect
      translateX.value = translateX.value - focalX.value * (scaleChange - 1);
      translateY.value = translateY.value - focalY.value * (scaleChange - 1);
      
      scale.value = newScale;
    })
    .onEnd(() => {
      // Clamp translation to bounds after zoom
      const clamped = clampTranslation(translateX.value, translateY.value, scale.value);
      translateX.value = clamped.x;
      translateY.value = clamped.y;
      
      // Spring to clamped scale if needed
      const clampedScale = clampScale(scale.value);
      if (clampedScale !== scale.value) {
        scale.value = withSpring(clampedScale, {
          damping: 20,
          stiffness: 300,
        });
      }
    });

  // Pan gesture - use simultaneousWithExternalGesture to allow ScrollViews to work
  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10]) // Require 10px movement before activating (allows ScrollView to work)
    .activeOffsetY([-10, 10])
    .simultaneousWithExternalGesture(pinchGesture)
    .onStart(() => {
      // Save current position as starting point
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      // New position = starting position + gesture translation
      // Panning should feel natural at any zoom level
      const newX = startX.value + e.translationX;
      const newY = startY.value + e.translationY;
      const clamped = clampTranslation(newX, newY, scale.value);
      translateX.value = clamped.x;
      translateY.value = clamped.y;
    })
    .onEnd(() => {
      // Spring back if out of bounds (provides nice feedback)
      const clamped = clampTranslation(translateX.value, translateY.value, scale.value);
      if (clamped.x !== translateX.value) {
        translateX.value = withSpring(clamped.x, {
          damping: 20,
          stiffness: 300,
        });
      }
      if (clamped.y !== translateY.value) {
        translateY.value = withSpring(clamped.y, {
          damping: 20,
          stiffness: 300,
        });
      }
    });

  // Combine gestures
  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  // Animated style for the canvas content
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        // Center the content initially, then apply pan and zoom
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  return (
    <View style={styles.container}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.canvas, animatedStyle]}>
          <View
            style={[
              styles.content,
              {
                width: contentBounds.contentWidth,
                minHeight: contentBounds.contentHeight,
                padding,
              },
            ]}
          >
            {children}
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

// Export default for easier imports
export default InfiniteCanvas;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  canvas: {
    flex: 1,
    // Center the canvas content initially
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

