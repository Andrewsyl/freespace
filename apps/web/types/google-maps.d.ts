declare namespace google {
  namespace maps {
    type LatLngBoundsLiteral = {
      north: number;
      south: number;
      east: number;
      west: number;
    };
    const Geocoder: any;
    const InfoWindow: any;
    const Map: any;
    const Marker: {
      new (...args: any[]): any;
      MAX_ZINDEX: number;
    };
    const OverlayView: any;
    const Point: any;
    const LatLng: any;
    namespace places {
      const Autocomplete: any;
    }
  }
}

declare const google: any;
