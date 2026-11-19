#define RAD2DEG(rad)    ((rad)*(180.0L/M_PI))
#define DEG2RAD(deg)    ((deg)*(M_PI/180.0L))
#define ATanH(x)	    (0.5 * log((1 + x) / (1 - x)))

#define WMM_MAX_MODEL_DEGREES	12
#define WMM_MAX_SECULAR_VARIATION_MODEL_DEGREES 12
#define NUMTERMS ( ( WMM_MAX_MODEL_DEGREES + 1 ) * ( WMM_MAX_MODEL_DEGREES + 2 ) / 2 )

#define WMM_PS_MIN_LAT_DEGREE  -55 /* Minimum Latitude for  Polar Stereographic projection in degrees   */
#define WMM_PS_MAX_LAT_DEGREE   55 /* Maximum Latitude for Polar Stereographic projection in degrees    */
#define WMM_UTM_MIN_LAT_DEGREE -80.5  /* Minimum Latitude for UTM projection in degrees   */
#define WMM_UTM_MAX_LAT_DEGREE  84.5  /* Maximum Latitude for UTM projection in degrees   */

#define WMM_GEO_POLE_TOLERANCE  1e-5
#define WMM_USE_GEOID	1    /* 1 Geoid - Ellipsoid difference should be corrected, 0 otherwise */

#define Schmidt 168

const double wmm25gh1[Schmidt] = {
-29351.8,  -1410.8,   4545.4,  -2556.6,   2951.1,  -3133.6,   1649.3,   -815.1,   1361.0,  -2404.1, 
   -56.6,   1243.8,    237.5,    453.6,   -549.5,    895.0,    799.5,    278.6,     55.7,   -133.9, 
  -281.1,    212.0,     12.1,   -375.6,   -233.2,    368.9,     45.4,    187.2,    220.2,   -138.7, 
  -122.9,   -142.0,     43.0,     20.9,    106.1,     64.4,     63.8,    -18.4,     76.9,     16.8, 
  -115.7,     48.8,    -40.9,    -59.8,     14.9,     10.9,    -60.7,     72.7,     79.5,    -77.0, 
   -48.9,     -8.8,    -14.4,     59.3,     -1.0,     15.8,     23.4,      2.5,     -7.4,    -11.1, 
   -25.1,     14.2,     -2.3,     23.2,     10.8,      7.1,    -17.5,    -12.6,      2.0,     11.4, 
   -21.7,     -9.7,     16.9,     12.7,     15.0,      0.7,    -16.8,     -5.2,      0.9,      3.9, 
     4.6,      7.8,    -24.8,      3.0,     12.2,     -0.2,      8.3,     -2.5,     -3.3,    -13.1, 
    -5.2,      2.4,      7.2,      8.6,     -0.6,     -8.7,      0.8,    -12.9,     10.0,     -1.3, 
    -6.4,      3.3,      0.2,      0.0,      2.0,      2.4,     -1.0,      5.3,     -0.6,     -9.1, 
    -0.9,      0.4,      1.5,     -4.2,      0.9,     -3.8,     -2.7,      0.9,     -3.9,     -9.1, 
     2.9,     -1.5,      0.0,     -2.5,      2.9,      2.4,     -0.6,     -0.6,      0.2,     -0.1, 
     0.5,     -0.6,     -0.3,     -0.1,     -1.2,      1.1,     -1.7,     -1.0,     -2.9,     -0.2, 
    -1.8,      2.6,     -2.3,     -2.0,     -0.2,     -1.3,      0.3,      0.7,      1.2,      1.0, 
    -1.3,     -1.4,      0.6,     -0.0,      0.6,      0.6,      0.5,     -0.1,     -0.1,      0.8, 
    -0.4,      0.1,     -0.2,     -1.0,     -1.3,      0.1,     -0.7,      0.2
      };

const double wmm25gh2[Schmidt] = {
    12.0,      9.7,    -21.5,    -11.6,     -5.2,    -27.7,     -8.0,    -12.1,     -1.3,     -4.2, 
     4.0,      0.4,     -0.3,    -15.6,     -4.1,     -1.6,     -2.4,     -1.1,     -6.0,      4.1, 
     5.6,      1.6,     -7.0,     -4.4,      0.6,      1.4,     -0.5,      0.0,      2.2,      0.6, 
     0.4,      2.2,      1.7,      0.9,      1.9,     -0.2,     -0.4,      0.3,      0.9,     -1.6, 
     1.2,     -0.4,     -0.9,      0.9,      0.3,      0.7,      0.9,      0.9,     -0.0,     -0.1, 
     0.6,     -0.1,      0.5,      0.5,     -0.8,     -0.1,      0.0,     -0.8,     -1.0,     -0.8, 
     0.6,      0.8,     -0.2,     -0.1,      0.2,     -0.2,      0.0,      0.5,      0.5,     -0.4, 
    -0.1,      0.4,      0.3,     -0.5,      0.2,     -0.6,     -0.0,      0.3,      0.2,      0.2, 
    -0.0,     -0.1,     -0.3,      0.1,      0.3,      0.3,     -0.3,     -0.3,      0.3,      0.0, 
     0.2,      0.3,     -0.1,     -0.1,     -0.2,      0.1,      0.4,     -0.1,      0.1,      0.1, 
     0.0,      0.0,      0.1,     -0.0,      0.1,     -0.2,     -0.0,      0.1,     -0.3,     -0.1, 
     0.0,      0.1,     -0.1,      0.0,     -0.1,     -0.1,     -0.0,      0.2,     -0.0,     -0.0, 
     0.0,     -0.0,     -0.0,      0.0,      0.1,      0.0,     -0.0,      0.0,      0.1,     -0.1, 
    -0.0,      0.0,     -0.0,     -0.0,      0.1,     -0.1,     -0.0,     -0.1,      0.0,     -0.1, 
     0.0,     -0.1,      0.0,      0.0,      0.0,     -0.0,     -0.0,      0.0,     -0.0,     -0.1, 
    -0.0,      0.1,     -0.0,     -0.0,      0.1,     -0.0,     -0.0,     -0.0,      0.0,      0.0, 
     0.0,     -0.0,     -0.1,     -0.0,     -0.0,      0.0,     -0.1,     -0.1
      };

#include "egm961500.h"

typedef struct {
			bool GEOID;
			double lambda;// longitude
			double phi; // geodetic latitude
			double HeightAboveEllipsoid; // height above the ellipsoid (HaE)
			double HeightAboveGeoid;  /* (height above the EGM96 geoid model ) */
			} WMMtype_CoordGeodetic;

typedef struct {
			double EditionDate;
			double epoch;       //Base time of Geomagnetic model epoch (yrs)
			char  ModelName[20];
			double *Main_Field_Coeff_G;         // C - Gauss coefficients of main geomagnetic model (nT)
			double *Main_Field_Coeff_H;         // C - Gauss coefficients of main geomagnetic model (nT)
			double *Secular_Var_Coeff_G; // CD - Gauss coefficients of secular geomagnetic model (nT/yr)
			double *Secular_Var_Coeff_H; // CD - Gauss coefficients of secular geomagnetic model (nT/yr)
			int nMax; // Maximum degree of spherical harmonic model
			int nMaxSecVar;//Maxumum degree of spherical harmonic secular model
			int SecularVariationUsed; //Whether or not the magnetic secular variation vector will be needed by program
			} WMMtype_MagneticModel;

typedef struct {
			double a; /*semi-major axis of the ellipsoid*/
			double b; /*semi-minor axis of the ellipsoid*/
			double fla; /* flattening */
			double epssq; /*first eccentricity squared */
			double eps; /* first eccentricity */
			double re;/* mean radius of  ellipsoid*/
			} WMMtype_Ellipsoid;

typedef struct {
			double *Pcup;  /* Legendre Function */
			double *dPcup; /* Derivative of Lagendre fn */
				} WMMtype_LegendreFunction;

typedef struct {
			int NumbGeoidCols ;   /* 360 degrees of longitude at 15 minute spacing */
			int NumbGeoidRows ;   /* 180 degrees of latitude  at 15 minute spacing */
			int NumbHeaderItems ;    /* min, max lat, min, max long, lat, long spacing*/
			float *GeoidHeightBuffer;
			int Decimate;
			int NumbGeoidElevs;
			} WMMtype_Geoid;

typedef struct {
			double Decl; 	/* 1. Angle between the magnetic field vector and true north, positive east*/
			double Incl; 	/*2. Angle between the magnetic field vector and the horizontal plane, positive down*/
			double F; 		/*3. Magnetic Field Strength*/
			double H; 		/*4. Horizontal Magnetic Field Strength*/
			double X; 		/*5. Northern component of the magnetic field vector*/
			double Y; 		/*6. Eastern component of the magnetic field vector*/
			double Z; 		/*7. Downward component of the magnetic field vector*/
			double Decldot; /*9. Yearly Rate of change in declination*/
			double Incldot; /*10. Yearly Rate of change in inclination*/
			double Fdot; 	/*11. Yearly rate of change in Magnetic field strength*/
			double Hdot; 	/*12. Yearly rate of change in horizontal field strength*/
			double Xdot; 	/*13. Yearly rate of change in the northern component*/
			double Ydot; 	/*14. Yearly rate of change in the eastern component*/
			double Zdot; 	/*15. Yearly rate of change in the downward component*/
			} WMMtype_GeoMagneticElements;

typedef struct {
			double lambda;/* longitude*/
			double phig;/* geocentric latitude*/
			double r;  /* distance from the center of the ellipsoid*/
			} WMMtype_CoordSpherical;

typedef struct {
			int	Year;
			int	Month;
			int	Day;
			double DecimalYear;     /* decimal years */
			} WMMtype_Date;

typedef struct {
			double Bx;    /* North */
			double By;	  /* East */
			double Bz;    /* Down */
			} WMMtype_MagneticResults;

typedef struct {
			double RelativeRadiusPower[WMM_MAX_MODEL_DEGREES+1];  /* [earth_reference_radius_km / sph. radius ]^n  */
			double cos_mlambda[WMM_MAX_MODEL_DEGREES+1]; /*cp(m)  - cosine of (m*spherical coord. longitude)*/
			double sin_mlambda[WMM_MAX_MODEL_DEGREES+1]; /* sp(m)  - sine of (m*spherical coord. longitude) */
			}   WMMtype_SphericalHarmonicVariables;

typedef struct {
			char Longitude[40];
			char Latitude[40];
			} WMMtype_CoordGeodeticStr;

class WMM
{
public:
	WMM();
   ~WMM();

	void WMM_TimelyModifyMagneticModel(WMMtype_Date UserDate);
	void WMM_GeodeticToSpherical(WMMtype_CoordGeodetic CoordGeodetic, WMMtype_CoordSpherical *CoordSpherical);
	void WMM_Geomag(WMMtype_CoordSpherical CoordSpherical, WMMtype_CoordGeodetic CoordGeodetic, WMMtype_GeoMagneticElements  *GeoMagneticElements);
	void WMM_ConvertGeoidToEllipsoidHeight (WMMtype_CoordGeodetic *CoordGeodetic);
	double WMM_GetEpoch(){return MagneticModel->epoch;}
	int WMM_GetSecularVariationUsed(){return MagneticModel->SecularVariationUsed;}
	double magneticDeclination(double longitude, double latitude, double year);

private:
	WMMtype_MagneticModel* MagneticModel;
	WMMtype_MagneticModel* TimedMagneticModel;
	WMMtype_Ellipsoid* Ellip;
	WMMtype_Geoid* Geoid;

	void WMM_readMagneticModel();
	void WMM_InitializeGeoid();
	void WMM_Summation(WMMtype_LegendreFunction *LegendreFunction, WMMtype_SphericalHarmonicVariables SphVariables, WMMtype_CoordSpherical CoordSpherical, WMMtype_MagneticResults *MagneticResults);
	void WMM_SummationSpecial(WMMtype_SphericalHarmonicVariables SphVariables, WMMtype_CoordSpherical CoordSpherical, WMMtype_MagneticResults *MagneticResults);
	void WMM_SecVarSummation(WMMtype_LegendreFunction *LegendreFunction, WMMtype_SphericalHarmonicVariables SphVariables, WMMtype_CoordSpherical CoordSpherical, WMMtype_MagneticResults *MagneticResults);
	void WMM_SecVarSummationSpecial(WMMtype_SphericalHarmonicVariables SphVariables, WMMtype_CoordSpherical CoordSpherical, WMMtype_MagneticResults *MagneticResults);
	void WMM_GetGeoidHeight (double Latitude, double Longitude,	double *DeltaHeight);
	void WMM_ComputeSphericalHarmonicVariables(WMMtype_CoordSpherical CoordSpherical, int nMax, WMMtype_SphericalHarmonicVariables *SphVariables);
	void WMM_AssociatedLegendreFunction(WMMtype_CoordSpherical CoordSpherical, int nMax, WMMtype_LegendreFunction *LegendreFunction);
	void WMM_PcupLow( double *Pcup, double *dPcup, double x, int nMax);
	void WMM_PcupHigh(double *Pcup, double *dPcup, double x, int nMax);
	void WMM_RotateMagneticVector(WMMtype_CoordSpherical CoordSpherical, WMMtype_CoordGeodetic CoordGeodetic, WMMtype_MagneticResults MagneticResultsSph, WMMtype_MagneticResults *MagneticResultsGeo);
	void WMM_CalculateGeoMagneticElements(WMMtype_MagneticResults *MagneticResultsGeo, WMMtype_GeoMagneticElements *GeoMagneticElements);
	void WMM_CalculateSecularVariation(WMMtype_MagneticResults MagneticVariation, WMMtype_GeoMagneticElements *MagneticElements);
};
