import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Dimensions,
  Modal,
  ModalProps,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  runOnJS, runOnUI,
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from "react-native-reanimated";
import { getBottomInset } from 'rn-iphone-helper';
import {
  GestureEventPayload,
  GestureHandlerRootView,
  PanGestureHandler,
  PanGestureHandlerEventPayload,
} from 'react-native-gesture-handler';
import {getStatusBarHeight} from 'react-native-safearea-height';

const AnimatePressable = Animated.createAnimatedComponent(Pressable);
export const BottomSheetModalContainerHeight = 16 + getBottomInset();
export const IndicatorHeight = 36;

export interface BottomSheetModalRef {
  visible: (modal_height?: number) => void;
  unVisible: () => void;
}

export default forwardRef<
  BottomSheetModalRef,
  {
    children: React.ReactNode;
    snapPoints?: Array<number>;
    onVisible?: () => void;
    onUnVisible?: () => void;
    backgroundClick?: boolean;
    gap?: number;
    backgroundStyle?: ViewStyle;
    modalContainerStyle?: ViewStyle;
    indicatorStyle?: ViewStyle;
    modalStyle?: ViewStyle;
    modalProps?: ModalProps;
    animationDuration?: number;
    springMass?: number;
    onAutoHeight?: (height: number) => void;
    autoHeight?: boolean;
    visibleIndicator?: boolean;
    rootViewPaddingHorizontal?: number;
    dragable?: boolean;
  }
>(function (props, ref) {
  const { height } = useWindowDimensions();

  const modalHeight = useSharedValue(height);
  const modalStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: modalHeight.value }],
  }));

  const [visible, setVisible] = useState(false);

  const modalContainerStyle = useMemo<ViewStyle>(
    () => ({
      height: height + (props.gap ?? 32) + 100,
    }),
    [height, props.gap]
  );
  const realScreenHeight = useMemo<number>(() =>
      Dimensions.get('screen').height - (getBottomInset() ?? 0) - getStatusBarHeight(false),
    [height]);
  const isIos = useMemo<boolean>(() => Platform.OS === 'ios', []);


  const nowHeight = useRef(0);
  const childrenHeight = useRef<null | number>(null);

  const unVisibleModal = useCallback(() => {
    cancelAnimation(modalHeight);
    nowHeight.current = height;
    modalHeight.value = withTiming(height, {
      duration: props.animationDuration ?? 250,
    });
    setTimeout(() => {
      setVisible(false);
      if (props.onUnVisible) {
        props.onUnVisible();
      }
    }, (props.animationDuration ?? 250) - 50);
  }, [height, modalHeight, props]);

  const handleBackgroundPress = useCallback(() => {
    if (props.backgroundClick) {
      unVisibleModal();
    }
  }, [props.backgroundClick, unVisibleModal]);

  const onPanGestureActive = useCallback(
    (event: GestureEventPayload & PanGestureHandlerEventPayload) => {
      const changeHeight = nowHeight.current + event.translationY;

      function getMaximum() {
        if (props.snapPoints && props.snapPoints.length >= 1) {
          return (
            height -
            props.snapPoints[props.snapPoints.length - 1] -
            (props.gap ?? 32)
          );
        } else if (
          (props.autoHeight && (props.dragable ?? props.visibleIndicator)) ||
          (!props.autoHeight && (props.dragable ?? props.visibleIndicator))
        ) {
          return 0;
        } else {
          return nowHeight.current;
        }
      }

      if (
        (
          props.snapPoints?.[0] ||
          (props.autoHeight && (props.dragable ?? props.visibleIndicator)) ||
          (!props.autoHeight && (props.dragable ?? props.visibleIndicator))
        ) &&
        changeHeight < height - (props.snapPoints?.[0] ?? 0) &&
        changeHeight > getMaximum()
      ) {
        modalHeight.value = nowHeight.current + event.translationY;
      }
    },
    [
      height,
      modalHeight,
      props.gap,
      props.snapPoints,
      props.autoHeight,
      props.dragable,
      props.visibleIndicator
    ],
  );

  const onPanGestureEnd = useCallback(() => {
    let h = 0;

    if (props.snapPoints) {
      nowHeight.current = modalHeight.value;

      const minFilteredArr = props.snapPoints.filter(
        s => s <= height - nowHeight.current
      );
      const nearSnapPoints = [
        minFilteredArr[minFilteredArr.length - 1],
        props.snapPoints?.filter(s => s >= height - nowHeight.current)[0],
      ];

      if (props.snapPoints?.[0] && !props.snapPoints?.[1]) {
        h = height - props.snapPoints[0];

        nowHeight.current = h;
        modalHeight.value = withSpring(h, {
          mass: props.springMass ?? 0.7,
        });
      } else if (props.snapPoints) {
        if (
          height -
          (nearSnapPoints[0] + (nearSnapPoints[1] - nearSnapPoints[0]) / 2) >
          nowHeight.current
        ) {
          h = height - nearSnapPoints[1];

          nowHeight.current = h;
          modalHeight.value = withSpring(h, {
            mass: props.springMass ?? 0.7,
          });
        } else {
          h = height - nearSnapPoints[0];

          nowHeight.current = h;
          modalHeight.value = withSpring(h, {
            mass: props.springMass ?? 0.7,
          });
        }
      }
    } else {
      if (
        (height - modalHeight.value) >
        ((height - nowHeight.current) / 2)
      ) {
        h = nowHeight.current;

        nowHeight.current = h;
        modalHeight.value = withSpring(h, {
          mass: props.springMass ?? 0.7,
        });
      } else {
        h = height;

        unVisibleModal();
      }
    }

    if (props.onAutoHeight) {
      props.onAutoHeight(h);
    }
  }, [height, modalHeight, props]);

  const handler = useAnimatedGestureHandler({
    onActive: event => runOnJS(onPanGestureActive)(event),
    onEnd: () => runOnJS(onPanGestureEnd)(),
  });

  useImperativeHandle(
    ref,
    () => ({
      visible: (modal_height?: number) => {
        if (!modal_height && !props.snapPoints && !props.autoHeight) {
          console.warn(
            'modal_height and snapPoints is not valid. Pls write and try again'
          );
        } else if (props.autoHeight) {
          setVisible(true);
          if (props.onVisible) {
            props.onVisible();
          }
          cancelAnimation(modalHeight);

          const autoHeight = (childrenHeight?.current ?? 0) + (props.snapPoints ? IndicatorHeight : 0) + (getBottomInset() ?? 24);

          nowHeight.current = height - autoHeight;
          modalHeight.value = withTiming(height - autoHeight, {
            duration: 250,
          });
        } else if (modal_height) {
          setVisible(true);
          if (props.onVisible) {
            props.onVisible();
          }
          cancelAnimation(modalHeight);
          nowHeight.current = height - modal_height;
          modalHeight.value = withTiming(height - modal_height, {
            duration: 250,
          });
        } else if (props.snapPoints && props.snapPoints?.[0]) {
          setVisible(true);
          if (props.onVisible) {
            props.onVisible();
          }
          cancelAnimation(modalHeight);
          nowHeight.current = height - props.snapPoints[0];
          modalHeight.value = withTiming(height - props.snapPoints[0], {
            duration: 250,
          });
        } else {
          console.warn(
            'If you want not use modal_height, you need write snapPints[0]'
          );
        }
      },
      unVisible: unVisibleModal,
    }),
    [height, modalHeight, props, unVisibleModal]
  );

  useEffect(() => {
    if (
      JSON.stringify(props.snapPoints) !==
      JSON.stringify(props.snapPoints?.sort((x, y) => x - y))
    ) {
      console.warn('Sort the numbers in ascending order');
    } else if (
      props.snapPoints?.length !== new Set(props.snapPoints).size &&
      props.snapPoints
    ) {
      console.warn('Do not include duplicate values in array');
    }
  }, [props.snapPoints]);

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType={'fade'}
      style={props.modalStyle ?? {}}
      {...(props.modalProps ?? {})}>
      <GestureHandlerRootView style={styles.gesture_handler}>
        <PanGestureHandler onGestureEvent={handler}>
          <AnimatePressable
            onPress={handleBackgroundPress}
            style={[styles.root, props.backgroundStyle ?? {}]}>
            <AnimatePressable
              style={[
                modalContainerStyle,
                styles.modal_container,
                modalStyle,
                props.modalContainerStyle ?? {},
              ]}>
              {(!!props.snapPoints?.length || props.visibleIndicator) && (
                <View style={[styles.indicator, props.indicatorStyle ?? {}]} />
              )}
              <View
                style={[styles.view, {paddingHorizontal: props.rootViewPaddingHorizontal ?? 20}]}
                onLayout={e => {
                  if (props.autoHeight) {
                    childrenHeight.current = e.nativeEvent.layout.height;

                    cancelAnimation(modalHeight);

                    const autoHeight = (childrenHeight?.current ?? 0) +
                      (props.snapPoints?.length || props.visibleIndicator ? IndicatorHeight : 0) +
                      (getBottomInset() ? getBottomInset() : 20) +
                      /* iOS sceen height is windowHeight + statusBar + bottomInset */
                      (isIos ? 0 : (realScreenHeight - height - (realScreenHeight - height)));

                    nowHeight.current = height - autoHeight;
                    modalHeight.value = withTiming(height - autoHeight, {
                      duration: 250,
                    });
                  }
                }}
              >
                {props.children}
              </View>
            </AnimatePressable>
          </AnimatePressable>
        </PanGestureHandler>
      </GestureHandlerRootView>
    </Modal>
  );
});

const styles = StyleSheet.create({
  gesture_handler: {
    flex: 1,
  },
  root: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modal_container: {
    width: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: '#fff',
    paddingTop: 4,
    paddingBottom: getBottomInset() + 12,
    alignItems: 'center',
  },
  indicator: {
    marginVertical: 16,
    marginLeft: 'auto',
    marginRight: 'auto',
    width: 32,
    height: 4,
    backgroundColor: '#79747e',
    borderRadius: 2,
    opacity: 0.4,
  },
  view: {
    display: 'flex',
    alignItems: 'center',
  }
});
