import React, {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from 'react';
import {
    Modal,
    ModalProps,
    Pressable,
    useWindowDimensions,
    ViewStyle,
} from 'react-native';
import styled from 'styled-components/native';
import Animated, {
    cancelAnimation,
    runOnJS,
    useAnimatedGestureHandler,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { getBottomInset } from 'rn-iphone-helper';
import {
    GestureEventPayload,
    GestureHandlerRootView,
    PanGestureHandler,
    PanGestureHandlerEventPayload,
} from 'react-native-gesture-handler';

export interface IBottomSheetModalRef {
    visible: (modal_height?: number) => void;
    unVisible: () => void;
}

interface IProps {
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
}

const Root = styled(Animated.createAnimatedComponent(Pressable))`
  flex: 1;
  background-color: rgba(0, 0, 0, 0.5);
`;

export const BottomSheetModalContainerHeight = 16 + getBottomInset();

const ModalContainer = styled(Animated.createAnimatedComponent(Pressable))<{
    height: number;
}>`
  width: 100%;
  height: ${props => props.height + 100}px;
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  background-color: #fff;
  padding-top: 4px;
  padding-bottom: ${getBottomInset() + 12}px;
  align-items: center;
`;

export const IndicatorHeight = 36;

const Indicator = styled.View`
  margin: 16px auto;
  width: 32px;
  height: 4px;
  background-color: #79747e;
  border-radius: 2px;
  opacity: 0.4;
`;

const GestureHandlerRoot = styled(GestureHandlerRootView)`
  flex: 1;
`;

export default forwardRef<IBottomSheetModalRef, IProps>(function (props, ref) {
    const { height } = useWindowDimensions();

    const modalHeight = useSharedValue(height);
    const modalStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: modalHeight.value }],
    }));

    const [visible, setVisible] = useState(false);

    const nowHeight = useRef(0);

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
                if (props.snapPoints && props.snapPoints.length >= 2) {
                    return (
                        height -
                        props.snapPoints[props.snapPoints.length - 1] -
                        (props.gap ?? 32)
                    );
                } else if (props.snapPoints) {
                    return height - props.snapPoints[0] - (props.gap ?? 32);
                } else {
                    return nowHeight.current;
                }
            }

            if (
                props.snapPoints?.[0] &&
                changeHeight < height - props.snapPoints[0] &&
                changeHeight > getMaximum()
            ) {
                modalHeight.value = nowHeight.current + event.translationY;
            }
        },
        [height, modalHeight, props.gap, props.snapPoints]
    );

    const onPanGestureEnd = useCallback(() => {
        nowHeight.current = modalHeight.value;

        if (props.snapPoints) {
            const minFilteredArr = props.snapPoints.filter(
                s => s <= height - nowHeight.current
            );
            const nearSnapPoints = [
                minFilteredArr[minFilteredArr.length - 1],
                props.snapPoints?.filter(s => s >= height - nowHeight.current)[0],
            ];

            if (props.snapPoints?.[0] && !props.snapPoints?.[1]) {
                nowHeight.current = height - props.snapPoints[0];
                modalHeight.value = withSpring(height - props.snapPoints[0], {
                    mass: props.springMass ?? 0.7,
                });
            } else if (props.snapPoints) {
                if (
                    height -
                    (nearSnapPoints[0] + (nearSnapPoints[1] - nearSnapPoints[0]) / 2) >
                    nowHeight.current
                ) {
                    nowHeight.current = height - nearSnapPoints[1];
                    modalHeight.value = withSpring(height - nearSnapPoints[1], {
                        mass: props.springMass ?? 0.7,
                    });
                } else {
                    nowHeight.current = height - nearSnapPoints[0];
                    modalHeight.value = withSpring(height - nearSnapPoints[0], {
                        mass: props.springMass ?? 0.7,
                    });
                }
            }
        }
    }, [height, modalHeight, props.snapPoints]);

    const handler = useAnimatedGestureHandler({
        onActive: event => runOnJS(onPanGestureActive)(event),
        onEnd: () => runOnJS(onPanGestureEnd)(),
    });

    useImperativeHandle(
        ref,
        () => ({
            visible: (modal_height?: number) => {
                if (!modal_height && !props.snapPoints) {
                    console.warn(
                        'modal_height and snapPoints is not valid. Pls write and try again'
                    );
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
            <GestureHandlerRoot>
                <PanGestureHandler onGestureEvent={handler}>
                    <Root
                        onPress={handleBackgroundPress}
                        style={props.backgroundStyle ?? {}}>
                        <ModalContainer
                            style={[modalStyle, props.modalContainerStyle ?? {}]}
                            height={height}>
                            {!!props.snapPoints?.length && (
                                <Indicator style={props.indicatorStyle ?? {}} />
                            )}
                            {props.children}
                        </ModalContainer>
                    </Root>
                </PanGestureHandler>
            </GestureHandlerRoot>
        </Modal>
    );
});
