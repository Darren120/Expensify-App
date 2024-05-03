// Explanation: Different Mapbox libraries are required for web and native mobile platforms.
// This is why we have separate components for web and native to handle the specific implementations.
// For the web version, we use the Mapbox Web library called react-map-gl, while for the native mobile version,
// we utilize a different Mapbox library @rnmapbox/maps tailored for mobile development.
import {useFocusEffect} from '@react-navigation/native';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import React, {forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState} from 'react';
import type {MapRef} from 'react-map-gl';
import Map, {Marker} from 'react-map-gl';
import {View} from 'react-native';
import {withOnyx} from 'react-native-onyx';
import Animated, {useAnimatedStyle, useSharedValue, withTiming} from 'react-native-reanimated';
import Icon from '@components/Icon';
import * as Expensicons from '@components/Icon/Expensicons';
import {PressableWithoutFeedback} from '@components/Pressable';
import useStyleUtils from '@hooks/useStyleUtils';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import colors from '@styles/theme/colors';
import variables from '@styles/variables';
import setUserLocation from '@userActions/UserLocation';
import CONST from '@src/CONST';
import useLocalize from '@src/hooks/useLocalize';
import useNetwork from '@src/hooks/useNetwork';
import getCurrentPosition from '@src/libs/getCurrentPosition';
import ONYXKEYS from '@src/ONYXKEYS';
import Direction from './Direction';
import './mapbox.css';
import type {MapViewHandle} from './MapViewTypes';
import PendingMapView from './PendingMapView';
import responder from './responder';
import type {ComponentProps, MapViewOnyxProps} from './types';
import utils from './utils';

const MapView = forwardRef<MapViewHandle, ComponentProps>(
    (
        {
            style,
            styleURL,
            waypoints,
            mapPadding,
            accessToken,
            userLocation: cachedUserLocation,
            directionCoordinates,
            initialState = {location: CONST.MAPBOX.DEFAULT_COORDINATE, zoom: CONST.MAPBOX.DEFAULT_ZOOM},
            interactive = true,
        },
        ref,
    ) => {
        const {isOffline} = useNetwork();
        const {translate} = useLocalize();
        const centerButtonOpacity = useSharedValue(1);
        const [shouldDisplayCenterButton, setShouldDisplayCenterButton] = useState(false);
        const centerButtonAnimatedStyle = useAnimatedStyle(() => ({
            opacity: centerButtonOpacity.value,
        }));

        const theme = useTheme();
        const styles = useThemeStyles();
        const StyleUtils = useStyleUtils();

        const [mapRef, setMapRef] = useState<MapRef | null>(null);
        const [currentPosition, setCurrentPosition] = useState(cachedUserLocation);
        const [userInteractedWithMap, setUserInteractedWithMap] = useState(false);
        const [shouldResetBoundaries, setShouldResetBoundaries] = useState<boolean>(false);
        const setRef = useCallback((newRef: MapRef | null) => setMapRef(newRef), []);
        const shouldInitializeCurrentPosition = useRef(true);

        // Determines if map can be panned to user's detected
        // location without bothering the user. It will return
        // false if user has already started dragging the map or
        // if there are one or more waypoints present.
        const shouldPanMapToCurrentPosition = useCallback(() => !userInteractedWithMap && (!waypoints || waypoints.length === 0), [userInteractedWithMap, waypoints]);

        const setCurrentPositionToInitialState = useCallback(() => {
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
            if (cachedUserLocation || !initialState) {
                return;
            }
            setCurrentPosition({longitude: initialState.location[0], latitude: initialState.location[1]});
        }, [initialState, cachedUserLocation]);

        const toggleCenterButton = useCallback(
            (toggleOn: boolean) => {
                if (toggleOn) {
                    setShouldDisplayCenterButton(true);
                    centerButtonOpacity.value = withTiming(1, {duration: CONST.MAPBOX.CENTER_BUTTON_FADE_DURATION});
                } else {
                    centerButtonOpacity.value = withTiming(0, {duration: CONST.MAPBOX.CENTER_BUTTON_FADE_DURATION}, () => setShouldDisplayCenterButton(false));
                }
            },
            [centerButtonOpacity],
        );

        useFocusEffect(
            useCallback(() => {
                if (isOffline) {
                    return;
                }

                if (!shouldInitializeCurrentPosition.current) {
                    return;
                }

                shouldInitializeCurrentPosition.current = false;

                if (!shouldPanMapToCurrentPosition()) {
                    setCurrentPositionToInitialState();
                    return;
                }

                getCurrentPosition((params) => {
                    const currentCoords = {longitude: params.coords.longitude, latitude: params.coords.latitude};
                    setCurrentPosition(currentCoords);
                    setUserLocation(currentCoords);
                }, setCurrentPositionToInitialState);
            }, [isOffline, shouldPanMapToCurrentPosition, setCurrentPositionToInitialState]),
        );

        useEffect(() => {
            if (!currentPosition || !mapRef) {
                return;
            }

            if (!shouldPanMapToCurrentPosition()) {
                return;
            }

            mapRef.flyTo({
                center: [currentPosition.longitude, currentPosition.latitude],
                zoom: CONST.MAPBOX.DEFAULT_ZOOM,
            });
        }, [currentPosition, userInteractedWithMap, mapRef, shouldPanMapToCurrentPosition]);

        const resetBoundaries = useCallback(() => {
            if (!waypoints || waypoints.length === 0) {
                return;
            }

            if (!mapRef) {
                return;
            }

            if (waypoints.length === 1) {
                if (utils.areSameCoordinate([currentPosition?.longitude ?? 0, currentPosition?.latitude ?? 0], [...waypoints[0].coordinate])) {
                    toggleCenterButton(false);
                } else {
                    toggleCenterButton(true);
                }
                mapRef.flyTo({
                    center: waypoints[0].coordinate,
                    zoom: CONST.MAPBOX.SINGLE_MARKER_ZOOM,
                });
                return;
            }

            const map = mapRef.getMap();
            toggleCenterButton(false);
            const {northEast, southWest} = utils.getBounds(
                waypoints.map((waypoint) => waypoint.coordinate),
                directionCoordinates,
            );
            map.fitBounds([northEast, southWest], {padding: mapPadding});
        }, [waypoints, mapRef, mapPadding, directionCoordinates, toggleCenterButton, currentPosition]);

        useEffect(resetBoundaries, [resetBoundaries]);

        useEffect(() => {
            if (!shouldResetBoundaries) {
                return;
            }

            resetBoundaries();
            setShouldResetBoundaries(false);
            // eslint-disable-next-line react-hooks/exhaustive-deps -- this effect only needs to run when the boundaries reset is forced
        }, [shouldResetBoundaries]);

        useEffect(() => {
            if (!mapRef) {
                return;
            }

            const resizeObserver = new ResizeObserver(() => {
                mapRef.resize();
                setShouldResetBoundaries(true);
            });
            resizeObserver.observe(mapRef.getContainer());

            return () => {
                resizeObserver?.disconnect();
            };
        }, [mapRef]);

        useImperativeHandle(
            ref,
            () => ({
                flyTo: (location: [number, number], zoomLevel: number = CONST.MAPBOX.DEFAULT_ZOOM, animationDuration?: number) =>
                    mapRef?.flyTo({
                        center: location,
                        zoom: zoomLevel,
                        duration: animationDuration,
                    }),
                fitBounds: (northEast: [number, number], southWest: [number, number]) => mapRef?.fitBounds([northEast, southWest]),
            }),
            [mapRef],
        );

        const centerMap = useCallback(() => {
            if (!mapRef) {
                return;
            }
            const currentZoom = mapRef.getZoom();
            if (directionCoordinates && directionCoordinates.length > 1) {
                const {northEast, southWest} = utils.getBounds(waypoints?.map((waypoint) => waypoint.coordinate) ?? [], directionCoordinates);
                const map = mapRef?.getMap();
                map?.fitBounds([southWest, northEast], {padding: mapPadding, animate: true, duration: CONST.MAPBOX.ANIMATION_DURATION_ON_CENTER_ME, maxZoom: currentZoom});
                toggleCenterButton(false);
                return;
            }

            mapRef.flyTo({
                center: [currentPosition?.longitude ?? 0, currentPosition?.latitude ?? 0],
                zoom: CONST.MAPBOX.SINGLE_MARKER_ZOOM,
                bearing: 0,
                animate: true,
                duration: CONST.MAPBOX.ANIMATION_DURATION_ON_CENTER_ME,
            });

            toggleCenterButton(false);
        }, [directionCoordinates, currentPosition, mapRef, waypoints, mapPadding, toggleCenterButton]);

        const onDragEnd = useCallback(() => toggleCenterButton(true), [toggleCenterButton]);

        return !isOffline && Boolean(accessToken) && Boolean(currentPosition) ? (
            <View
                style={style}
                // eslint-disable-next-line react/jsx-props-no-spreading
                {...responder.panHandlers}
            >
                <Map
                    onDrag={() => setUserInteractedWithMap(true)}
                    onDragEnd={onDragEnd}
                    ref={setRef}
                    mapLib={mapboxgl}
                    mapboxAccessToken={accessToken}
                    initialViewState={{
                        longitude: currentPosition?.longitude,
                        latitude: currentPosition?.latitude,
                        zoom: initialState.zoom,
                    }}
                    style={StyleUtils.getTextColorStyle(theme.mapAttributionText)}
                    mapStyle={styleURL}
                    interactive={interactive}
                >
                    <Marker
                        key="Current-position"
                        longitude={currentPosition?.longitude ?? 0}
                        latitude={currentPosition?.latitude ?? 0}
                    >
                        <View style={{backgroundColor: colors.blue400, width: 16, height: 16, borderRadius: 16}} />
                    </Marker>
                    {waypoints?.map(({coordinate, markerComponent, id}) => {
                        const MarkerComponent = markerComponent;
                        if (utils.areSameCoordinate([coordinate[0], coordinate[1]], [currentPosition?.longitude ?? 0, currentPosition?.latitude ?? 0])) {
                            return null;
                        }
                        return (
                            <Marker
                                key={id}
                                longitude={coordinate[0]}
                                latitude={coordinate[1]}
                            >
                                <MarkerComponent />
                            </Marker>
                        );
                    })}
                    {directionCoordinates && <Direction coordinates={directionCoordinates} />}
                </Map>
                {shouldDisplayCenterButton && (
                    <Animated.View style={[styles.pAbsolute, styles.p5, styles.t0, styles.r0, {zIndex: 1}, {opacity: 1}, centerButtonAnimatedStyle]}>
                        <PressableWithoutFeedback
                            accessibilityRole={CONST.ROLE.BUTTON}
                            onPress={centerMap}
                            accessibilityLabel="Center"
                        >
                            <View style={styles.primaryMediumIcon}>
                                <Icon
                                    width={variables.iconSizeNormal}
                                    height={variables.iconSizeNormal}
                                    src={Expensicons.Crosshair}
                                    fill={theme.icon}
                                />
                            </View>
                        </PressableWithoutFeedback>
                    </Animated.View>
                )}
            </View>
        ) : (
            <PendingMapView
                title={translate('distance.mapPending.title')}
                subtitle={isOffline ? translate('distance.mapPending.subtitle') : translate('distance.mapPending.onlineSubtitle')}
                style={styles.mapEditView}
            />
        );
    },
);

export default withOnyx<ComponentProps, MapViewOnyxProps>({
    userLocation: {
        key: ONYXKEYS.USER_LOCATION,
    },
})(MapView);
