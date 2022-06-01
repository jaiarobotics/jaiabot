/*
 * ABSTRACT
 *
 *    The purpose of WMM Subroutine Library is to support the World Magnetic Model (WMM) 2010-2015.
 *
 *
 *
 * REUSE NOTES
 *
 *  WMM Subroutine Library is intended for reuse by any application that requires
 * Computation of Geomagnetic field from WMM model.
 *
 * REFERENCES
 *
 *    Further information on Geoid can be found in the WMM Technical Documents.
 *
 *
 * LICENSES
 *
 *  The WMM source code is in the public domain and not licensed or under copyright.
 *	The information and software may be used freely by the public. As required by 17 U.S.C. 403,
 *	third parties producing copyrighted works consisting predominantly of the material produced by
 *	U.S. government agencies must provide notice with such work(s) identifying the U.S. Government material
 *	incorporated and stating that such material is not subject to copyright protection.
 *
 * RESTRICTIONS
 *
 *    WMM Subroutine library has no restrictions.
 *
 * ENVIRONMENT
 *
 *    WMM Subroutine library was tested in the following environments
 *
 *    1. Red Hat Linux  with GCC Compiler
 *    2. MS Windows XP with CodeGear C++ compiler
 *    3. Sun Solaris with GCC Compiler
 *
 *
 * MODIFICATIONS
 *
 *    Date                 Version
 *    ----                 -----------
 *    Jul 15, 2009         0.1
 *    Nov 17, 2009         0.2
	  Nov 23, 2009		   0.3

*	Contact Information


*  Sponsoring Government Agency
*  National Geospatial-Intelligence Agency
*  PRG / CSAT, M.S. L-41
*  3838 Vogel Road
*  Arnold, MO 63010
*  Attn: Craig Rollins
*  Phone:  (314) 263-4186
*  Email:  Craig.M.Rollins@Nga.Mil


*  National Geophysical Data Center
*  NOAA EGC/2
*  325 Broadway
*  Boulder, CO 80303 USA
*  Attn: Susan McLean
*  Phone:  (303) 497-6478
*  Email:  Susan.McLean@noaa.gov


*  Software and Model Support
*  National Geophysical Data Center
*  NOAA EGC/2
*  325 Broadway"
*  Boulder, CO 80303 USA
*  Attn: Manoj Nair or Stefan Maus
*  Phone:  (303) 497-6522 or -6522
*  Email:  Manoj.C.Nair@noaa.gov or Stefan.Maus@noaa.gov
*  URL: http://www.ngdc.noaa.gov/Geomagnetic/WMM/DoDWMM.shtml


*  For more details on the subroutines, please consult the WMM
*  Technical Documentations at
*  http://www.ngdc.noaa.gov/Geomagnetic/WMM/DoDWMM.shtml

*  Nov 23, 2009
*  Written by Manoj C Nair and Adam Woods
*  Manoj.C.Nair@Noaa.Gov

* C++ Port by Garry Petrie
* garry@petries.net

*/

#include <cstring>
#include "stdafx.h"

#include "WMM.h"

using namespace std;

WMM::WMM()
{
	MagneticModel = new WMMtype_MagneticModel;
	MagneticModel->Main_Field_Coeff_G = new double[NUMTERMS];
	MagneticModel->Main_Field_Coeff_H = new double[NUMTERMS];
	MagneticModel->Secular_Var_Coeff_G = new double[NUMTERMS];
	MagneticModel->Secular_Var_Coeff_H = new double[NUMTERMS];

	TimedMagneticModel = new WMMtype_MagneticModel;
	TimedMagneticModel->Main_Field_Coeff_G = new double[NUMTERMS];
	TimedMagneticModel->Main_Field_Coeff_H = new double[NUMTERMS];
	TimedMagneticModel->Secular_Var_Coeff_G = new double[NUMTERMS];
	TimedMagneticModel->Secular_Var_Coeff_H = new double[NUMTERMS];


		/* Sets WGS-84 parameters */
	    Ellip = new WMMtype_Ellipsoid;
		Ellip->a	=			6378.137; /*semi-major axis of the ellipsoid in */
		Ellip->b	=			6356.7523142;/*semi-minor axis of the ellipsoid in */
		Ellip->fla	=			1/298.257223563;/* flattening */
		Ellip->eps	=			sqrt(1- ( Ellip->b *	Ellip->b) / (Ellip->a * Ellip->a ));  /*first eccentricity */
		Ellip->epssq	=			(Ellip->eps * Ellip->eps);   /*first eccentricity squared */
		Ellip->re	=			6371.2;/* Earth's radius */

	   /* Sets Magnetic Model parameters */

		MagneticModel->nMax = WMM_MAX_MODEL_DEGREES;
		MagneticModel->nMaxSecVar = WMM_MAX_SECULAR_VARIATION_MODEL_DEGREES;

	   /* Sets EGM-96 model file parameters */
		Geoid = new WMMtype_Geoid;
		Geoid->NumbGeoidCols = 1441;   /* 360 degrees of longitude at 15 minute spacing */
		Geoid->NumbGeoidRows = 721;   /* 180 degrees of latitude  at 15 minute spacing */
		Geoid->NumbHeaderItems = 6;    /* min, max lat, min, max long, lat, long spacing*/
		Geoid->NumbGeoidElevs  = Geoid->NumbGeoidCols * Geoid->NumbGeoidRows;
		Geoid->Decimate = 1;
		Geoid->GeoidHeightBuffer = NULL;

	WMM_readMagneticModel();
	WMM_InitializeGeoid();    /* Read the Geoid file */

	TimedMagneticModel->EditionDate          = MagneticModel->EditionDate;
	TimedMagneticModel->epoch                = MagneticModel->epoch;
	TimedMagneticModel->nMax                 = MagneticModel->nMax;
	TimedMagneticModel->nMaxSecVar           = MagneticModel->nMaxSecVar;
	TimedMagneticModel->SecularVariationUsed = MagneticModel->SecularVariationUsed;
	strcpy(TimedMagneticModel->ModelName, MagneticModel->ModelName);
	for (int i = 0; i < NUMTERMS; i++)
	{
		TimedMagneticModel->Main_Field_Coeff_G[i] = MagneticModel->Main_Field_Coeff_G[i];
		TimedMagneticModel->Main_Field_Coeff_H[i] = MagneticModel->Main_Field_Coeff_H[i];
		TimedMagneticModel->Secular_Var_Coeff_G[i] = MagneticModel->Secular_Var_Coeff_G[i];
		TimedMagneticModel->Secular_Var_Coeff_H[i] = MagneticModel->Secular_Var_Coeff_H[i];
	}
}

WMM::~WMM()
{
	delete [] MagneticModel->Main_Field_Coeff_G;
	delete [] MagneticModel->Main_Field_Coeff_H;
	delete [] MagneticModel->Secular_Var_Coeff_G;
	delete [] MagneticModel->Secular_Var_Coeff_H;
	delete MagneticModel;

	delete [] TimedMagneticModel->Main_Field_Coeff_G;
	delete [] TimedMagneticModel->Main_Field_Coeff_H;
	delete [] TimedMagneticModel->Secular_Var_Coeff_G;
	delete [] TimedMagneticModel->Secular_Var_Coeff_H;
	delete TimedMagneticModel;

	delete Ellip;

	if (Geoid->GeoidHeightBuffer) delete [] Geoid->GeoidHeightBuffer;
	delete Geoid;
}

void WMM::WMM_InitializeGeoid()
	/*
	 * The function reads Geoid data from the file EMG9615.BIN in
	 * the current directory and builds the Geoid grid from it.
	 * If the Geoid file can not be found or accessed, an error is printed
	 * and function returns false code. If the file is incomplete
	 * or improperly formatted, an error is printed
	 * and function returns false code.

	 INPUT  Pointer to data structure Geoid with the following elements
			int NumbGeoidCols ;   ( 360 degrees of longitude at 15 minute spacing )
			int NumbGeoidRows ;   ( 180 degrees of latitude  at 15 minute spacing )
			int NumbHeaderItems ;    ( min, max lat, min, max long, lat, long spacing )
			int	ScaleFactor;    ( 4 grid cells per degree at 15 minute spacing  )
			float *GeoidHeightBuffer;   (Pointer to the memory to store the Geoid elevation data )
			int NumbGeoidElevs;    (number of points in the gridded file )
			int  Geoid_Initialized ;  ( indicates successful initialization )

	OUPUT  Pointer to data structure Geoid with the following elements updated
			int NumbGeoidCols ;   ( 360 degrees of longitude at 15 minute spacing )
			int NumbGeoidRows ;   ( 180 degrees of latitude  at 15 minute spacing )
			int NumbHeaderItems ;    ( min, max lat, min, max long, lat, long spacing )
			int	ScaleFactor;    ( 4 grid cells per degree at 15 minute spacing  )
			float *GeoidHeightBuffer;   (Pointer to the memory to store the Geoid elevation data )
			int NumbGeoidElevs;    (number of points in the gridded file )
	CALLS : none
	 */
	{
  int   ElevationsRead;
  FILE  *GeoidHeightFile;


   /*  Open the File READONLY, or Return Error Condition.	EMG9615.BIN is binary
	dump of the ascii file WW15MGH.GRD. This file contains  EGM96 Geoid heights
	in 15x15 min resolution. The binary file supplied with the WMM package is
	Little Endian. Now check the system to determine its Endianness*/

  if (( GeoidHeightFile = fopen( "EGM9615.BIN" , "rb" ) ) != NULL)
  {
    Geoid->GeoidHeightBuffer = new float[Geoid->NumbGeoidElevs + 1];

	ElevationsRead = (int)fread(Geoid->GeoidHeightBuffer, sizeof(float), Geoid->NumbGeoidElevs, GeoidHeightFile);

	fclose(GeoidHeightFile);
  }
  else
  {
  	Geoid->NumbGeoidCols = 145;
	Geoid->NumbGeoidRows = 73;
	Geoid->NumbHeaderItems = 6;
	Geoid->NumbGeoidElevs  = Geoid->NumbGeoidCols * Geoid->NumbGeoidRows;
    Geoid->GeoidHeightBuffer = new float[Geoid->NumbGeoidElevs + 1];
	for (int i = 0; i < Geoid->NumbGeoidElevs; i++)	Geoid->GeoidHeightBuffer[i] = (float)egm9615[i];
	Geoid->Decimate = 10;
  }
  /*
  if (( GeoidHeightFile = fopen( "EGM961500.TXT" , "w" ) ) != NULL)
  {
	  char buf[12];
	  for (int i = 0; i <= 721; i++)
	  {
		  for (int j = 0; j <= 1441; j++)
		  {
			  if (i % 10 == 0 && j % 10 == 0)
				{
				sprintf(buf, "%11.7f,", Geoid->GeoidHeightBuffer[i*1441 + j]);
				fwrite(buf, sizeof(buf), 1, GeoidHeightFile);
				if (j == 1440) fwrite("\n", 1, 1, GeoidHeightFile);
				}
		  }
	  }
	  fclose(GeoidHeightFile);
  }*/
	}  /*WMM_InitializeGeoid*/

void WMM::WMM_GetGeoidHeight (double Latitude, double Longitude,	double *DeltaHeight)
/*
 * The  function WMM_GetGeoidHeight returns the height of the
 * EGM96 geiod above or below the WGS84 ellipsoid,
 * at the specified geodetic coordinates,
 * using a grid of height adjustments from the EGM96 gravity model.
 *
 *    Latitude            : Geodetic latitude in radians           (input)
 *    Longitude           : Geodetic longitude in radians          (input)
 *    DeltaHeight         : Height Adjustment, in meters.          (output)
 *    Geoid				  : WMMtype_Geoid with Geoid grid		   (input)
	CALLS : none
 */
{
  long   Index;
  double DeltaX, DeltaY;
  double ElevationSE, ElevationSW, ElevationNE, ElevationNW;
  double OffsetX, OffsetY;
  double PostX, PostY;
  double UpperY, LowerY;

  *DeltaHeight = 0.0;

	/*  Compute X and Y Offsets into Geoid Height Array:                          */

	if (Longitude < 0.0)
	  OffsetX = ( Longitude + 360.0 ) * ((int)(Geoid->NumbGeoidCols / (360/Geoid->Decimate)));
	else
	  OffsetX = Longitude * ((int)(Geoid->NumbGeoidCols / (360/Geoid->Decimate)));

	OffsetY = ( 90.0 - Latitude ) * ((int)(Geoid->NumbGeoidRows / (180/Geoid->Decimate)));

	/*  Find Four Nearest Geoid Height Cells for specified Latitude, Longitude;   */
	/*  Assumes that (0,0) of Geoid Height Array is at Northwest corner:          */

	OffsetX /= Geoid->Decimate;
	OffsetY /= Geoid->Decimate;

	PostX = floor( OffsetX );
	if ((PostX + 1) == Geoid->NumbGeoidCols) PostX--;

	PostY = floor( OffsetY );
	if ((PostY + 1) == Geoid->NumbGeoidRows) PostY--;

	Index = (long)(PostY * Geoid->NumbGeoidCols + PostX);
	ElevationNW = ( double ) Geoid->GeoidHeightBuffer[ Index ];
	ElevationNE = ( double ) Geoid->GeoidHeightBuffer[ Index+ 1 ];

	Index = (long)((PostY + 1) * Geoid->NumbGeoidCols + PostX);
	ElevationSW = ( double ) Geoid->GeoidHeightBuffer[ Index ];
	ElevationSE = ( double ) Geoid->GeoidHeightBuffer[ Index + 1 ];

	/*  Perform Bi-Linear Interpolation to compute Height above Ellipsoid:        */

	DeltaX = OffsetX - PostX;
	DeltaY = OffsetY - PostY;

	UpperY = ElevationNW + DeltaX * ( ElevationNE - ElevationNW );
	LowerY = ElevationSW + DeltaX * ( ElevationSE - ElevationSW );

	*DeltaHeight = UpperY + DeltaY * ( LowerY - UpperY );
}  /*WMM_GetGeoidHeight*/

void WMM::WMM_ConvertGeoidToEllipsoidHeight (WMMtype_CoordGeodetic *CoordGeodetic)

/*
 * The function Convert_Geoid_To_Ellipsoid_Height converts the specified WGS84
 * Geoid height at the specified geodetic coordinates to the equivalent
 * ellipsoid height, using the EGM96 gravity model.
 *
  *   CoordGeodetic->phi        : Geodetic latitude in degress           (input)
 *    CoordGeodetic->lambda     : Geodetic longitude in degrees          (input)
 *    CoordGeodetic->HeightAboveEllipsoid	     : Ellipsoid height, in kilometers         (output)
 *    CoordGeodetic->HeightAboveGeoid: Geoid height, in kilometers           (input)
 *
	CALLS : WMM_GetGeoidHeight (

 */
{
  double  DeltaHeight;

    if (WMM_USE_GEOID == 1 && CoordGeodetic->GEOID)      /* Geoid correction required */
	{
		WMM_GetGeoidHeight ( CoordGeodetic->phi, CoordGeodetic->lambda, &DeltaHeight);
		CoordGeodetic->HeightAboveEllipsoid = CoordGeodetic->HeightAboveGeoid + DeltaHeight / 1000; /*  Input and output should be kilometers,
			However WMM_GetGeoidHeight returns Geoid height in meters - Hence division by 1000 */
	}
	else     /* Geoid correction not required, copy the MSL height to Ellipsoid height */
		CoordGeodetic->HeightAboveEllipsoid = CoordGeodetic->HeightAboveGeoid;

} /* WMM_ConvertGeoidToEllipsoidHeight*/

void WMM::WMM_readMagneticModel()
{

/* READ WORLD Magnetic MODEL SPHERICAL HARMONIC COEFFICIENTS (WMM.cof)
   INPUT :  filename
   	MagneticModel : Pointer to the data structure with the following fields required as inputs
				nMax : 	Number of static coefficients
   UPDATES : MagneticModel : Pointer to the data structure with the following fields populated
				char  *ModelName;
				double epoch;       Base time of Geomagnetic model epoch (yrs)
				double *Main_Field_Coeff_G;          C - Gauss coefficients of main geomagnetic model (nT)
				double *Main_Field_Coeff_H;          C - Gauss coefficients of main geomagnetic model (nT)
				double *Secular_Var_Coeff_G;  CD - Gauss coefficients of secular geomagnetic model (nT/yr)
				double *Secular_Var_Coeff_H;  CD - Gauss coefficients of secular geomagnetic model (nT/yr)
	CALLS : none

*/

	char filename[] = "WMM.COF";

	FILE *WMM_COF_File;
	char c_str[81], c_new[5];   /*these strings are used to read a line from coefficient file*/
	int i, icomp, m, n, EOF_Flag = 0, index;
	double epoch, gnm, hnm, dgnm, dhnm;

	MagneticModel->Main_Field_Coeff_H[0] = 0.0;
	MagneticModel->Main_Field_Coeff_G[0] = 0.0;
	MagneticModel->Secular_Var_Coeff_H[0] = 0.0;
	MagneticModel->Secular_Var_Coeff_G[0] = 0.0;

	WMM_COF_File = fopen(filename,"r");
	if (WMM_COF_File != NULL)
	{
		fgets(c_str, 80, WMM_COF_File);
		sscanf(c_str,"%lf%s",&epoch, MagneticModel->ModelName);
		MagneticModel->epoch = epoch;
		while (EOF_Flag == 0)
		{
			fgets(c_str, 80, WMM_COF_File);
		/* CHECK FOR LAST LINE IN FILE */
			for (i=0; i<4 && (c_str[i] != '\0'); i++)
			{
				c_new[i] = c_str[i];
				c_new[i+1] = '\0';
			}
			icomp = strcmp("9999", c_new);
			if (icomp == 0)
			{
				EOF_Flag = 1;
				break;
			}
		/* END OF FILE NOT ENCOUNTERED, GET VALUES */
			sscanf(c_str,"%d%d%lf%lf%lf%lf",&n,&m,&gnm,&hnm,&dgnm,&dhnm);
			if (m <= n)
			{
				index = (n * (n + 1) / 2 + m);
				MagneticModel->Main_Field_Coeff_G[index] = gnm;
				MagneticModel->Main_Field_Coeff_H[index] = hnm;
				MagneticModel->Secular_Var_Coeff_G[index] = dgnm;
				MagneticModel->Secular_Var_Coeff_H[index] = dhnm;
			}
		}

		fclose(WMM_COF_File);
	}
	else
	{
		MagneticModel->epoch = 2010;
		strcpy(MagneticModel->ModelName, "WMM-2010");

		int j;
		for (int i = 0; i < Schmidt; i++)
		{
			j = (int)sqrt((float)i);
			if ((i + j) % 2)
			{
				MagneticModel->Main_Field_Coeff_H[(i + j)/2 + 1] = wmm10gh1[i];
				MagneticModel->Secular_Var_Coeff_H[(i + j)/2 + 1] = wmm10gh2[i];
			}
			else
			{
				{
				MagneticModel->Main_Field_Coeff_G[(i + j)/2 + 1] = wmm10gh1[i];
				MagneticModel->Secular_Var_Coeff_G[(i + j)/2 + 1] = wmm10gh2[i];
				}
			}
		}
	}
} /*WMM_readMagneticModel */

void WMM::WMM_CalculateSecularVariation(WMMtype_MagneticResults MagneticVariation, WMMtype_GeoMagneticElements *MagneticElements)
/*This takes the Magnetic Variation in x, y, and z and uses it to calculate the secular variation of each of the Geomagnetic elements.
	INPUT     MagneticVariation   Data structure with the following elements
				double Bx;    ( North )
				double By;	  ( East )
				double Bz;    ( Down )
	OUTPUT   MagneticElements   Pointer to the data  structure with the following elements updated
			double Decldot; Yearly Rate of change in declination
			double Incldot; Yearly Rate of change in inclination
			double Fdot; Yearly rate of change in Magnetic field strength
			double Hdot; Yearly rate of change in horizontal field strength
			double Xdot; Yearly rate of change in the northern component
			double Ydot; Yearly rate of change in the eastern component
			double Zdot; Yearly rate of change in the downward component
			double GVdot;Yearly rate of chnage in grid variation
	CALLS : none

*/
{
	MagneticElements->Xdot = MagneticVariation.Bx;
	MagneticElements->Ydot = MagneticVariation.By;
	MagneticElements->Zdot = MagneticVariation.Bz;
	MagneticElements->Hdot = (MagneticElements->X * MagneticElements->Xdot + MagneticElements->Y * MagneticElements->Ydot) / MagneticElements->H; //See equation 29 in the WMM technical report
	MagneticElements->Fdot = (MagneticElements->X * MagneticElements->Xdot + MagneticElements->Y * MagneticElements->Ydot + MagneticElements->Z * MagneticElements->Zdot) / MagneticElements->F;
	MagneticElements->Decldot = 180.0 / M_PI * (MagneticElements->X * MagneticElements->Ydot - MagneticElements->Y * MagneticElements->Xdot) / (MagneticElements->H * MagneticElements->H);
	MagneticElements->Incldot = 180.0 / M_PI * (MagneticElements->H * MagneticElements->Zdot - MagneticElements->Z * MagneticElements->Hdot) / (MagneticElements->F * MagneticElements->F);
} /*WMM_CalculateSecularVariation*/

void WMM::WMM_CalculateGeoMagneticElements(WMMtype_MagneticResults *MagneticResultsGeo, WMMtype_GeoMagneticElements *GeoMagneticElements)

	/* Calculate all the Geomagnetic elements from X,Y and Z components
	INPUT     MagneticResultsGeo   Pointer to data structure with the following elements
				double Bx;    ( North )
				double By;	  ( East )
				double Bz;    ( Down )
	OUTPUT    GeoMagneticElements    Pointer to data structure with the following elements
				double Decl; (Angle between the magnetic field vector and true north, positive east)
				double Incl; Angle between the magnetic field vector and the horizontal plane, positive down
				double F; Magnetic Field Strength
				double H; Horizontal Magnetic Field Strength
				double X; Northern component of the magnetic field vector
				double Y; Eastern component of the magnetic field vector
				double Z; Downward component of the magnetic field vector
	CALLS : none
	*/
	{
	GeoMagneticElements->X = MagneticResultsGeo->Bx;
	GeoMagneticElements->Y = MagneticResultsGeo->By;
	GeoMagneticElements->Z = MagneticResultsGeo->Bz;

	GeoMagneticElements->H = sqrt (MagneticResultsGeo->Bx* MagneticResultsGeo->Bx + MagneticResultsGeo->By * MagneticResultsGeo->By);
	GeoMagneticElements->F = sqrt (GeoMagneticElements->H*GeoMagneticElements->H + MagneticResultsGeo->Bz * MagneticResultsGeo->Bz);
	GeoMagneticElements->Decl = RAD2DEG(atan2 (GeoMagneticElements->Y , GeoMagneticElements->X));
	GeoMagneticElements->Incl = RAD2DEG(atan2 (GeoMagneticElements->Z , GeoMagneticElements->H));
	}  /*WMM_CalculateGeoMagneticElements */

void WMM::WMM_RotateMagneticVector(WMMtype_CoordSpherical CoordSpherical, WMMtype_CoordGeodetic CoordGeodetic, WMMtype_MagneticResults MagneticResultsSph, WMMtype_MagneticResults *MagneticResultsGeo)
	/* Rotate the Magnetic Vectors to Geodetic Coordinates
	Manoj Nair, June, 2009 Manoj.C.Nair@Noaa.Gov
	Equation 26, WMM Technical report

	INPUT : CoordSpherical : Data structure WMMtype_CoordSpherical with the following elements
				double lambda; ( longitude)
				double phig; ( geocentric latitude )
				double r;  	  ( distance from the center of the ellipsoid)

			CoordGeodetic : Data structure WMMtype_CoordGeodetic with the following elements
				double lambda; (longitude)
				double phi; ( geodetic latitude)
				double HeightAboveEllipsoid; (height above the ellipsoid (HaE) )
				double HeightAboveGeoid;(height above the Geoid )

			MagneticResultsSph : Data structure WMMtype_MagneticResults with the following elements
				double Bx;     North
				double By;	   East
				double Bz;    Down

	OUTPUT: MagneticResultsGeo Pointer to the data structure WMMtype_MagneticResults, with the following elements
				double Bx;     North
				double By;	   East
				double Bz;    Down

	CALLS : none

	*/
	{
	double  Psi;
		 /* Difference between the spherical and Geodetic latitudes */
	Psi =  ( M_PI/180 ) * ( CoordSpherical.phig - CoordGeodetic.phi );

		 /* Rotate spherical field components to the Geodeitic system */
		MagneticResultsGeo->Bz =     MagneticResultsSph.Bx *  sin(Psi) + MagneticResultsSph.Bz * cos(Psi);
		MagneticResultsGeo->Bx =     MagneticResultsSph.Bx *  cos(Psi) - MagneticResultsSph.Bz * sin(Psi);
		MagneticResultsGeo->By =     MagneticResultsSph.By;
	}   /*WMM_RotateMagneticVector*/

void WMM::WMM_SecVarSummationSpecial(WMMtype_SphericalHarmonicVariables SphVariables, WMMtype_CoordSpherical CoordSpherical, WMMtype_MagneticResults *MagneticResults)
{
	/*Special calculation for the secular variation summation at the poles.


	INPUT: MagneticModel
		   SphVariables
		   CoordSpherical
	OUTPUT: MagneticResults
	CALLS : none


	*/
	int n, index;
	double k, sin_phi, *PcupS, schmidtQuasiNorm1, schmidtQuasiNorm2, schmidtQuasiNorm3;

	PcupS = new double[TimedMagneticModel->nMaxSecVar +1];

	PcupS[0] = 1;
	schmidtQuasiNorm1 = 1.0;

	MagneticResults->By = 0.0;
	sin_phi = sin ( DEG2RAD ( CoordSpherical.phig ) );

	for (n = 1; n <=  TimedMagneticModel->nMaxSecVar; n++)
	{
		index = (n * (n + 1) / 2 + 1);
		schmidtQuasiNorm2 = schmidtQuasiNorm1 * (double) (2 * n - 1) / (double) n;
		schmidtQuasiNorm3 = schmidtQuasiNorm2 *  sqrt( (double) (n * 2) / (double) (n + 1));
		schmidtQuasiNorm1 = schmidtQuasiNorm2;
		if (n == 1)
		{
			PcupS[n] = PcupS[n-1];
		}
		else
		{
			k = (double)( ( (n - 1) * (n - 1) ) - 1) / ( double ) ( (2 * n - 1) * (2 * n - 3) );
			PcupS[n] =     sin_phi * PcupS[n-1] - k * PcupS[n-2];
		}

/*		  1 nMax  (n+2)    n     m            m           m
	By =    SUM (a/r) (m)  SUM  [g cos(m p) + h sin(m p)] dP (sin(phi))
		   n=1             m=0   n            n           n  */
/* Derivative with respect to longitude, divided by radius. */

		MagneticResults->By += 	SphVariables.RelativeRadiusPower[n] *
					(	TimedMagneticModel->Secular_Var_Coeff_G[index]*SphVariables.sin_mlambda[1] -
						TimedMagneticModel->Secular_Var_Coeff_H[index]*SphVariables.cos_mlambda[1]  )
						*  PcupS[n] * schmidtQuasiNorm3;
	}

	delete [] PcupS;

}/*SecVarSummationSpecial*/

void WMM::WMM_SecVarSummation(WMMtype_LegendreFunction *LegendreFunction, WMMtype_SphericalHarmonicVariables SphVariables, WMMtype_CoordSpherical CoordSpherical, WMMtype_MagneticResults *MagneticResults)
{
	/*This Function sums the secular variation coefficients to get the secular variation of the Magnetic vector.
	INPUT :  LegendreFunction
			MagneticModel
			SphVariables
			CoordSpherical
	OUTPUT : MagneticResults

	CALLS : WMM_SecVarSummationSpecial

	*/
	int m, n, index;
	double cos_phi;
	TimedMagneticModel->SecularVariationUsed = 1;
	MagneticResults->Bz = 0.0;
	MagneticResults->By = 0.0;
	MagneticResults->Bx = 0.0;
	for (n = 1; n <=  TimedMagneticModel->nMaxSecVar; n++)
	{
		for (m=0;m<=n;m++)
		{
			index = (n * (n + 1) / 2 + m);

/*		    nMax  	(n+2) 	  n     m            m           m
	Bz =   -SUM (a/r)   (n+1) SUM  [g cos(m p) + h sin(m p)] P (sin(phi))
			n=1      	      m=0   n            n           n  */
/*  Derivative with respect to radius.*/
			MagneticResults->Bz -= 	SphVariables.RelativeRadiusPower[n] *
					(	TimedMagneticModel->Secular_Var_Coeff_G[index]*SphVariables.cos_mlambda[m] +
						TimedMagneticModel->Secular_Var_Coeff_H[index]*SphVariables.sin_mlambda[m]	)
						* (double) (n+1) * LegendreFunction-> Pcup[index];

/*		  1 nMax  (n+2)    n     m            m           m
	By =    SUM (a/r) (m)  SUM  [g cos(m p) + h sin(m p)] dP (sin(phi))
		   n=1             m=0   n            n           n  */
/* Derivative with respect to longitude, divided by radius. */
			MagneticResults->By += 	SphVariables.RelativeRadiusPower[n] *
					(	TimedMagneticModel->Secular_Var_Coeff_G[index]*SphVariables.sin_mlambda[m] -
						TimedMagneticModel->Secular_Var_Coeff_H[index]*SphVariables.cos_mlambda[m]  )
						* (double) (m) * LegendreFunction-> Pcup[index];
/*		   nMax  (n+2) n     m            m           m
	Bx = - SUM (a/r)   SUM  [g cos(m p) + h sin(m p)] dP (sin(phi))
		   n=1         m=0   n            n           n  */
/* Derivative with respect to latitude, divided by radius. */

			MagneticResults->Bx -= 	SphVariables.RelativeRadiusPower[n] *
					(	TimedMagneticModel->Secular_Var_Coeff_G[index]*SphVariables.cos_mlambda[m]  +
						TimedMagneticModel->Secular_Var_Coeff_H[index]*SphVariables.sin_mlambda[m]  )
						* LegendreFunction-> dPcup[index];
		}
	}
	cos_phi = cos ( DEG2RAD ( CoordSpherical.phig ) );

	if ( fabs(cos_phi) > 1.0e-10 )
		MagneticResults->By = MagneticResults->By / cos_phi ;
	else	/* Special calculation for component By at Geographic poles */
		WMM_SecVarSummationSpecial(SphVariables, CoordSpherical, MagneticResults);

} /*WMM_SecVarSummation*/

void WMM::WMM_SummationSpecial(WMMtype_SphericalHarmonicVariables SphVariables, WMMtype_CoordSpherical CoordSpherical, WMMtype_MagneticResults *MagneticResults)
	/* Special calculation for the component By at Geographic poles.
	Manoj Nair, June, 2009 manoj.c.nair@noaa.gov
    INPUT: MagneticModel
		   SphVariables
		   CoordSpherical
	OUTPUT: MagneticResults
	CALLS : none


	*/
	{
	int n, index;
	double k, sin_phi, *PcupS, schmidtQuasiNorm1, schmidtQuasiNorm2, schmidtQuasiNorm3;

	PcupS = new double[TimedMagneticModel->nMax +1];

	PcupS[0] = 1;
	schmidtQuasiNorm1 = 1.0;

	MagneticResults->By = 0.0;
	sin_phi = sin ( DEG2RAD ( CoordSpherical.phig ) );

	for (n = 1; n <=  TimedMagneticModel->nMax; n++)
	{

	/*Compute the ration between the Gauss-normalized associated Legendre
  functions and the Schmidt quasi-normalized version. This is equivalent to
  sqrt((m==0?1:2)*(n-m)!/(n+m!))*(2n-1)!!/(n-m)!  */

		index = (n * (n + 1) / 2 + 1);
		schmidtQuasiNorm2 = schmidtQuasiNorm1 * (double) (2 * n - 1) / (double) n;
		schmidtQuasiNorm3 = schmidtQuasiNorm2 *  sqrt( (double) (n * 2) / (double) (n + 1));
		schmidtQuasiNorm1 = schmidtQuasiNorm2;
		if (n == 1)
		{
			PcupS[n] = PcupS[n-1];
		}
		else
		{
			k = (double)( ( (n - 1) * (n - 1) ) - 1) / ( double ) ( (2 * n - 1) * (2 * n - 3) );
			PcupS[n] =     sin_phi * PcupS[n-1] - k * PcupS[n-2];
		}

/*		  1 nMax  (n+2)    n     m            m           m
	By =    SUM (a/r) (m)  SUM  [g cos(m p) + h sin(m p)] dP (sin(phi))
		   n=1             m=0   n            n           n  */
/* Equation 21 in the WMM Technical report. Derivative with respect to longitude, divided by radius. */

		MagneticResults->By += 	SphVariables.RelativeRadiusPower[n] *
					(	TimedMagneticModel->Main_Field_Coeff_G[index]*SphVariables.sin_mlambda[1] -
						TimedMagneticModel->Main_Field_Coeff_H[index]*SphVariables.cos_mlambda[1]  )
						*  PcupS[n] * schmidtQuasiNorm3;
	}

	delete [] PcupS;

	}/*WMM_SummationSpecial */

void WMM::WMM_Summation(WMMtype_LegendreFunction *LegendreFunction, WMMtype_SphericalHarmonicVariables SphVariables, WMMtype_CoordSpherical CoordSpherical, WMMtype_MagneticResults *MagneticResults)
{
	/* Computes Geomagnetic Field Elements X, Y and Z in Spherical coordinate system using
	spherical harmonic summation.


	The vector Magnetic field is given by -grad V, where V is Geomagnetic scalar potential
	The gradient in spherical coordinates is given by:

			 dV ^     1 dV ^        1     dV ^
	grad V = -- r  +  - -- t  +  -------- -- p
			 dr       r dt       r sin(t) dp


	INPUT :  LegendreFunction
			MagneticModel
			SphVariables
			CoordSpherical
	OUTPUT : MagneticResults

	CALLS : WMM_SummationSpecial



   Manoj Nair, June, 2009 Manoj.C.Nair@Noaa.Gov
   */
	int m, n, index;
	double cos_phi;
	MagneticResults->Bz = 0.0;
	MagneticResults->By = 0.0;
	MagneticResults->Bx = 0.0;
	for (n = 1; n <=  TimedMagneticModel->nMax; n++)
	{
		for (m=0;m<=n;m++)
		{
			index = (n * (n + 1) / 2 + m);

/*		    nMax  	(n+2) 	  n     m            m           m
	Bz =   -SUM (a/r)   (n+1) SUM  [g cos(m p) + h sin(m p)] P (sin(phi))
			n=1      	      m=0   n            n           n  */
/* Equation 22 in the WMM Technical report.  Derivative with respect to radius.*/
			MagneticResults->Bz -= 	SphVariables.RelativeRadiusPower[n] *
					(	TimedMagneticModel->Main_Field_Coeff_G[index]*SphVariables.cos_mlambda[m] +
						TimedMagneticModel->Main_Field_Coeff_H[index]*SphVariables.sin_mlambda[m]	)
						* (double) (n+1) * LegendreFunction-> Pcup[index];

/*		  1 nMax  (n+2)    n     m            m           m
	By =    SUM (a/r) (m)  SUM  [g cos(m p) + h sin(m p)] dP (sin(phi))
		   n=1             m=0   n            n           n  */
/* Equation 21 in the WMM Technical report. Derivative with respect to longitude, divided by radius. */
			MagneticResults->By += 	SphVariables.RelativeRadiusPower[n] *
					(	TimedMagneticModel->Main_Field_Coeff_G[index]*SphVariables.sin_mlambda[m] -
						TimedMagneticModel->Main_Field_Coeff_H[index]*SphVariables.cos_mlambda[m]  )
						* (double) (m) * LegendreFunction-> Pcup[index];
/*		   nMax  (n+2) n     m            m           m
	Bx = - SUM (a/r)   SUM  [g cos(m p) + h sin(m p)] dP (sin(phi))
		   n=1         m=0   n            n           n  */
/* Equation 20  in the WMM Technical report. Derivative with respect to latitude, divided by radius. */

			MagneticResults->Bx -= 	SphVariables.RelativeRadiusPower[n] *
					(	TimedMagneticModel->Main_Field_Coeff_G[index]*SphVariables.cos_mlambda[m]  +
						TimedMagneticModel->Main_Field_Coeff_H[index]*SphVariables.sin_mlambda[m]  )
						* LegendreFunction-> dPcup[index];



		}
	}

	cos_phi = cos ( DEG2RAD ( CoordSpherical.phig ) );

	if ( fabs(cos_phi) > 1.0e-10 )
		MagneticResults->By = MagneticResults->By / cos_phi ;
	else
		WMM_SummationSpecial(SphVariables, CoordSpherical, MagneticResults);

}/*WMM_Summation */

void WMM::WMM_PcupHigh(double *Pcup, double *dPcup, double x, int nMax)

/*	This function evaluates all of the Schmidt-semi normalized associated Legendre
	functions up to degree nMax. The functions are initially scaled by
	10^280 sin^m in order to minimize the effects of underflow at large m
	near the poles (see Holmes and Featherstone 2002, J. Geodesy, 76, 279-299).
	Note that this function performs the same operation as WMM_PcupLow.
	However this function also can be used for high degree (large nMax) models.

	Calling Parameters:
		INPUT
			nMax:	 Maximum spherical harmonic degree to compute.
			x:		cos(colatitude) or sin(latitude).

		OUTPUT
			Pcup:	A vector of all associated Legendgre polynomials evaluated at
					x up to nMax. The lenght must by greater or equal to (nMax+1)*(nMax+2)/2.
		  dPcup:   Derivative of Pcup(x) with respect to latitude

		CALLS : none
	Notes:



  Adopted from the FORTRAN code written by Mark Wieczorek September 25, 2005.

  Manoj Nair, Nov, 2009 Manoj.C.Nair@Noaa.Gov

  Change from the previous version
  The prevous version computes the derivatives as
  dP(n,m)(x)/dx, where x = sin(latitude) (or cos(colatitude) ).
  However, the WMM Geomagnetic routines requires dP(n,m)(x)/dlatitude.
  Hence the derivatives are multiplied by sin(latitude).
  Removed the options for CS phase and normalizations.

  Note: In geomagnetism, the derivatives of ALF are usually found with
  respect to the colatitudes. Here the derivatives are found with respect
  to the latitude. The difference is a sign reversal for the derivative of
  the Associated Legendre Functions.

  The derivates can't be computed for latitude = |90| degrees.
	*/
	{
	double  pm2, pm1, pmm, plm, rescalem, z, scalef;
	double *f1, *f2, *PreSqr;
	int k, kstart, m, n;

	f1 = new double[NUMTERMS + 1];
	PreSqr = new double[NUMTERMS + 1];
	f2 = new double[NUMTERMS + 1];

	scalef = 1.0e-280;

	for(n = 0 ; n <= 2*nMax+1 ; ++n )
	{
		PreSqr[n] = sqrt((double)(n));
	}

	k = 2;

	for(n=2 ; n<=nMax ; n++)
	{
		k = k + 1;
		f1[k] = (double)(2*n-1) /(double)(n);
		f2[k] = (double)(n-1) /(double)(n);
		for(m=1 ; m<=n-2 ; m++)
		{
			k = k+1;
			f1[k] = (double)(2*n-1) / PreSqr[n+m] / PreSqr[n-m];
			f2[k] = PreSqr[n-m-1] * PreSqr[n+m-1] / PreSqr[n+m] / PreSqr[n-m];
		}
		k = k + 2;
	}

	/*z = sin (geocentric latitude) */
	z = sqrt((1.0-x)*(1.0+x));
	pm2  = 1.0;
	Pcup[0] = 1.0;
	dPcup[0] = 0.0;

	pm1  		= x;
	Pcup[1] 	= pm1;
	dPcup[1] 	= z;
	k = 1;

	for(n = 2; n <= nMax; n++ )
	{
		k = k+n;
		plm = f1[k]*x*pm1-f2[k]*pm2;
		Pcup[k] = plm;
		dPcup[k] = (double)(n) * (pm1 - x * plm) / z;
		pm2  = pm1;
		pm1  = plm;
	}

	pmm = PreSqr[2]*scalef;
	rescalem = 1.0/scalef;
	kstart = 0;

	for(m = 1; m <= nMax - 1; ++m)
	{
		rescalem = rescalem*z;

		/* Calculate Pcup(m,m)*/
		kstart = kstart+m+1;
		pmm =  pmm * PreSqr[2*m+1] / PreSqr[2*m];
		Pcup[kstart] = pmm*rescalem / PreSqr[2*m+1];
		dPcup[kstart] = -((double)(m) * x * Pcup[kstart] / z);
		pm2 = pmm/PreSqr[2*m+1];
		/* Calculate Pcup(m+1,m)*/
		k = kstart+m+1 ;
		pm1 = x * PreSqr[2*m+1] * pm2;
		Pcup[k] = pm1*rescalem;
		dPcup[k] =   ((pm2*rescalem) * PreSqr[2*m+1] - x * (double)(m+1) * Pcup[k]) / z;
		/* Calculate Pcup(n,m)*/
		for(n = m+2; n <= nMax; ++n)
		{
			k = k+n;
			plm  = x*f1[k]*pm1-f2[k]*pm2;
			Pcup[k] = plm*rescalem;
			dPcup[k] = (PreSqr[n+m] * PreSqr[n-m] * (pm1 * rescalem) - (double)(n) * x * Pcup[k] ) / z;
			pm2  = pm1;
			pm1  = plm;
		}
	}

	/* Calculate Pcup(nMax,nMax)*/
	rescalem = rescalem*z;
	kstart = kstart+m+1;
	pmm =  pmm  / PreSqr[2*nMax];
	Pcup[kstart] = pmm * rescalem;
	dPcup[kstart] = -(double)(nMax) * x * Pcup[kstart] / z;

	delete [] f1;
	delete [] PreSqr;
	delete [] f2;
} /* WMM_PcupHigh */

void WMM::WMM_PcupLow( double *Pcup, double *dPcup, double x, int nMax)

/*   This function evaluates all of the Schmidt-semi normalized associated Legendre
	functions up to degree nMax.

	Calling Parameters:
		INPUT
			nMax:	 Maximum spherical harmonic degree to compute.
			x:		cos(colatitude) or sin(latitude).

		OUTPUT
			Pcup:	A vector of all associated Legendgre polynomials evaluated at
					x up to nMax.
		   dPcup: Derivative of Pcup(x) with respect to latitude

	Notes: Overflow may occur if nMax > 20 , especially for high-latitudes.
	Use WMM_PcupHigh for large nMax.

   Writted by Manoj Nair, June, 2009 . Manoj.C.Nair@Noaa.Gov.

  Note: In geomagnetism, the derivatives of ALF are usually found with
  respect to the colatitudes. Here the derivatives are found with respect
  to the latitude. The difference is a sign reversal for the derivative of
  the Associated Legendre Functions.
*/
{
	int n, m, index, index1, index2;
	double k, z, *schmidtQuasiNorm;
	Pcup[0] = 1.0;
	dPcup[0] = 0.0;
		/*sin (geocentric latitude) - sin_phi */
	z = sqrt( ( 1.0 - x ) * ( 1.0 + x ) ) ;

	schmidtQuasiNorm  = new double[NUMTERMS + 1];

	/*	 First,	Compute the Gauss-normalized associated Legendre  functions*/
	for (n = 1; n <=  nMax; n++)
	{
		for (m=0;m<=n;m++)
		{
		index = (n * (n + 1) / 2 + m);
			if (n == m)
			{
				index1 = ( n - 1 ) * n / 2 + m -1;
				Pcup [index]  = z * Pcup[index1];
				dPcup[index] = z *  dPcup[index1] + x *  Pcup[index1];
			}
			else if (n == 1 && m == 0)
			{
				index1 = ( n - 1 ) * n / 2 + m;
				Pcup[index]  = x *  Pcup[index1];
				dPcup[index] = x *  dPcup[index1] - z *  Pcup[index1];
			}
			else if (n > 1 && n != m)
			{
				index1 = ( n - 2 ) * ( n - 1 ) / 2 + m;
				index2 = ( n - 1) * n / 2 + m;
				if (m > n - 2)
				{
					Pcup[index]  = x *  Pcup[index2];
					dPcup[index] = x *  dPcup[index2] - z *  Pcup[index2];
				}
				else
				{
					k = (double)( ( ( n - 1 ) * ( n - 1 ) ) - ( m * m ) ) / ( double ) ( ( 2 * n - 1 ) * ( 2 * n - 3 ) );
					Pcup[index]  = x *  Pcup[index2]  - k  *  Pcup[index1];
					dPcup[index] = x *  dPcup[index2] - z *  Pcup[index2] - k *  dPcup[index1];
				}
			}
		}
	}
/*Compute the ration between the Gauss-normalized associated Legendre
  functions and the Schmidt quasi-normalized version. This is equivalent to
  sqrt((m==0?1:2)*(n-m)!/(n+m!))*(2n-1)!!/(n-m)!  */

	schmidtQuasiNorm[0] = 1.0;
	for (n = 1; n <= nMax; n++)
	{
		index = (n * (n + 1) / 2);
		index1 = (n - 1)  * n / 2 ;
		/* for m = 0 */
		schmidtQuasiNorm[index] =  schmidtQuasiNorm[index1] * (double) (2 * n - 1) / (double) n;

		for ( m = 1; m <= n; m++)
		{
			index = (n * (n + 1) / 2 + m);
			index1 = (n * (n + 1) / 2 + m - 1);
			schmidtQuasiNorm[index] = schmidtQuasiNorm[index1] * sqrt( (double) ((n - m + 1) * (m == 1 ? 2 : 1)) / (double) (n + m));
		}

	}

/* Converts the  Gauss-normalized associated Legendre
	  functions to the Schmidt quasi-normalized version using pre-computed
	  relation stored in the variable schmidtQuasiNorm */

	for (n = 1; n <=  nMax; n++)
	{
		for (m=0;m<=n;m++)
		{
			 index = (n * (n + 1) / 2 + m);
			 Pcup[index]  = Pcup[index]  *  schmidtQuasiNorm[index];
			 dPcup[index] =  - dPcup[index] *  schmidtQuasiNorm[index];
			 /* The sign is changed since the new WMM routines use derivative with respect to latitude
			 insted of co-latitude */
		}
	}

	delete [] schmidtQuasiNorm;
}   /*WMM_PcupLow */

void WMM::WMM_AssociatedLegendreFunction(WMMtype_CoordSpherical CoordSpherical, int nMax, WMMtype_LegendreFunction *LegendreFunction)

	/* Computes  all of the Schmidt-semi normalized associated Legendre
	functions up to degree nMax. If nMax <= 16, function WMM_PcupLow is used.
	Otherwise WMM_PcupHigh is called.
	INPUT  CoordSpherical 	A data structure with the following elements
							double lambda; ( longitude)
							double phig; ( geocentric latitude )
							double r;  	  ( distance from the center of the ellipsoid)
			nMax        	integer 	 ( Maxumum degree of spherical harmonic secular model)
			LegendreFunction Pointer to data structure with the following elements
							double *Pcup;  (  pointer to store Legendre Function  )
							double *dPcup; ( pointer to store  Derivative of Lagendre function )

	OUTPUT  LegendreFunction  Calculated Legendre variables in the data structure

	 */

	{
	double sin_phi =  sin ( DEG2RAD ( CoordSpherical.phig ) );       /* sin  (geocentric latitude) */

	if (nMax <= 16 || (1.0 - fabs(sin_phi)) < 1.0e-10 ) 	/* If nMax is less tha 16 or at the poles */
		WMM_PcupLow(LegendreFunction->Pcup,LegendreFunction->dPcup,sin_phi, nMax);
	else 
		WMM_PcupHigh(LegendreFunction->Pcup,LegendreFunction->dPcup,sin_phi, nMax);

	} /*WMM_AssociatedLegendreFunction */

void WMM::WMM_ComputeSphericalHarmonicVariables(WMMtype_CoordSpherical CoordSpherical, int nMax, WMMtype_SphericalHarmonicVariables *SphVariables)

   /* Computes Spherical variables
	  Variables computed are (a/r)^(n+2), cos_m(lamda) and sin_m(lambda) for spherical harmonic
	  summations. (Equations 20-22 in the WMM Technical Report)
	  INPUT   Ellip  data  structure with the following elements
				double a; semi-major axis of the ellipsoid
				double b; semi-minor axis of the ellipsoid
				double fla;  flattening
				double epssq; first eccentricity squared
				double eps;  first eccentricity
				double re; mean radius of  ellipsoid
			CoordSpherical 	A data structure with the following elements
				double lambda; ( longitude)
				double phig; ( geocentric latitude )
				double r;  	  ( distance from the center of the ellipsoid)
			nMax   integer 	 ( Maxumum degree of spherical harmonic secular model)\

	OUTPUT  SphVariables  Pointer to the   data structure with the following elements
		double RelativeRadiusPower[WMM_MAX_MODEL_DEGREES+1];   [earth_reference_radius_km  sph. radius ]^n
		double cos_mlambda[WMM_MAX_MODEL_DEGREES+1]; cp(m)  - cosine of (mspherical coord. longitude)
		double sin_mlambda[WMM_MAX_MODEL_DEGREES+1];  sp(m)  - sine of (mspherical coord. longitude)
	CALLS : none
	  */

	{
	double cos_lambda, sin_lambda;
	int m, n;
	cos_lambda = cos(DEG2RAD(CoordSpherical.lambda));
	sin_lambda = sin(DEG2RAD(CoordSpherical.lambda));
	/* for n = 0 ... model_order, compute (Radius of Earth / Spherica radius r)^(n+2)
	for n  1..nMax-1 (this is much faster than calling pow MAX_N+1 times).      */
	SphVariables->RelativeRadiusPower[0] = (Ellip->re / CoordSpherical.r) * (Ellip->re / CoordSpherical.r);
	for (n = 1; n <= nMax; n++)
	{
		SphVariables->RelativeRadiusPower[n] = SphVariables->RelativeRadiusPower[n-1] * (Ellip->re  / CoordSpherical.r);
	}

  /*
   Compute cos(m*lambda), sin(m*lambda) for m = 0 ... nMax
	 cos(a + b) = cos(a)*cos(b) - sin(a)*sin(b)
	 sin(a + b) = cos(a)*sin(b) + sin(a)*cos(b)
  */
	SphVariables->cos_mlambda[0] = 1.0;
	SphVariables->sin_mlambda[0] = 0.0;

	SphVariables->cos_mlambda[1] = cos_lambda;
	SphVariables->sin_mlambda[1] = sin_lambda;
	for (m = 2; m <= nMax; m++)
	{
		SphVariables->cos_mlambda[m] = SphVariables->cos_mlambda[m-1]*cos_lambda - SphVariables->sin_mlambda[m-1]*sin_lambda;
		SphVariables->sin_mlambda[m] = SphVariables->cos_mlambda[m-1]*sin_lambda + SphVariables->sin_mlambda[m-1]*cos_lambda;
	}
}  /*WMM_ComputeSphericalHarmonicVariables*/

void WMM::WMM_Geomag(WMMtype_CoordSpherical CoordSpherical, WMMtype_CoordGeodetic CoordGeodetic, WMMtype_GeoMagneticElements  *GeoMagneticElements)
   /*
   The main subroutine that calls a sequence of WMM sub-functions to calculate the magnetic field elements for a single point.
   The function expects the model coefficients and point coordinates as input and returns the magnetic field elements and
   their rate of change.

   INPUT: Ellipd
		 CoordSpherical
		 CoordGeodetic
		 TimedMagneticModel

   OUTPUT : GeoMagneticElements

   CALLS:  	WMM_AllocateLegendreFunctionMemory(NumTerms);  ( For storing the ALF functions )
			WMM_ComputeSphericalHarmonicVariables( Ellip, CoordSpherical, TimedMagneticModel->nMax, &SphVariables); (Compute Spherical Harmonic variables  )
			WMM_AssociatedLegendreFunction(CoordSpherical, TimedMagneticModel->nMax, LegendreFunction);  	Compute ALF  Equation 5, WMM Technical report )
			WMM_Summation(LegendreFunction, TimedMagneticModel, SphVariables, CoordSpherical, &MagneticResultsSph);  Accumulate the spherical harmonic coefficients Equations 20:22 , WMM Technical report
			WMM_SecVarSummation(LegendreFunction, TimedMagneticModel, SphVariables, CoordSpherical, &MagneticResultsSphVar); Sum the Secular Variation Coefficients, Equations 23:25 , WMM Technical report
			WMM_RotateMagneticVector(CoordSpherical, CoordGeodetic, MagneticResultsSph, &MagneticResultsGeo); Map the computed Magnetic fields to Geodeitic coordinates Equation 26 , WMM Technical report
			WMM_RotateMagneticVector(CoordSpherical, CoordGeodetic, MagneticResultsSphVar, &MagneticResultsGeoVar);  Map the secular variation field components to Geodetic coordinates, Equation 27 , WMM Technical report
			WMM_CalculateGeoMagneticElements(&MagneticResultsGeo, GeoMagneticElements);   Calculate the Geomagnetic elements, Equation 28 , WMM Technical report
			WMM_CalculateSecularVariation(MagneticResultsGeoVar, GeoMagneticElements); Calculate the secular variation of each of the Geomagnetic elements, Equation 29, WMM Technical report

   */
	{
	WMMtype_LegendreFunction* LegendreFunction = new WMMtype_LegendreFunction;
	LegendreFunction->Pcup = new double[NUMTERMS];
	LegendreFunction->dPcup = new double[NUMTERMS];

	WMMtype_SphericalHarmonicVariables SphVariables;
	WMMtype_MagneticResults MagneticResultsSph, MagneticResultsGeo, MagneticResultsSphVar, MagneticResultsGeoVar;

	WMM_ComputeSphericalHarmonicVariables(CoordSpherical, TimedMagneticModel->nMax, &SphVariables); /* Compute Spherical Harmonic variables  */
	WMM_AssociatedLegendreFunction(CoordSpherical, TimedMagneticModel->nMax, LegendreFunction);  	/* Compute ALF  Equation 5, WMM Technical report*/
	WMM_Summation(LegendreFunction, SphVariables, CoordSpherical, &MagneticResultsSph); /* Accumulate the spherical harmonic coefficients Equations 20:22 , WMM Technical report*/
	WMM_SecVarSummation(LegendreFunction, SphVariables, CoordSpherical, &MagneticResultsSphVar); /*Sum the Secular Variation Coefficients, Equations 23:25 , WMM Technical report  */
	WMM_RotateMagneticVector(CoordSpherical, CoordGeodetic, MagneticResultsSph, &MagneticResultsGeo); /* Map the computed Magnetic fields to Geodeitic coordinates Equation 26 , WMM Technical report */
	WMM_RotateMagneticVector(CoordSpherical, CoordGeodetic, MagneticResultsSphVar, &MagneticResultsGeoVar); /* Map the secular variation field components to Geodetic coordinates, Equation 27 , WMM Technical report*/
	WMM_CalculateGeoMagneticElements(&MagneticResultsGeo, GeoMagneticElements);   /* Calculate the Geomagnetic elements, Equation 28 , WMM Technical report */
	WMM_CalculateSecularVariation(MagneticResultsGeoVar, GeoMagneticElements); /*Calculate the secular variation of each of the Geomagnetic elements, Equation 29, WMM Technical report*/

	delete [] LegendreFunction->Pcup;
	delete [] LegendreFunction->dPcup;
	delete LegendreFunction;
	}

void WMM::WMM_GeodeticToSpherical(WMMtype_CoordGeodetic CoordGeodetic, WMMtype_CoordSpherical *CoordSpherical)

	/* Converts Geodetic coordinates to Spherical coordinates

	  INPUT   Ellip  data  structure with the following elements
				double a; semi-major axis of the ellipsoid
				double b; semi-minor axis of the ellipsoid
				double fla;  flattening
				double epssq; first eccentricity squared
				double eps;  first eccentricity
				double re; mean radius of  ellipsoid

			CoordGeodetic  Pointer to the  data  structure with the following elements updates
				double lambda; ( longitude )
				double phi; ( geodetic latitude )
				double HeightAboveEllipsoid; ( height above the WGS84 ellipsoid (HaE) )
				double HeightAboveGeoid; (height above the EGM96 Geoid model )

	 OUTPUT		CoordSpherical 	Pointer to the data structure with the following elements
				double lambda; ( longitude)
				double phig; ( geocentric latitude )
				double r;  	  ( distance from the center of the ellipsoid)

	CALLS : none

	*/
	{
	double CosLat, SinLat, rc, xp, zp; /*all local variables */

	/*
	** Convert geodetic coordinates, (defined by the WGS-84
	** reference ellipsoid), to Earth Centered Earth Fixed Cartesian
	** coordinates, and then to spherical coordinates.
	*/

	CosLat = cos(DEG2RAD(CoordGeodetic.phi));
	SinLat = sin(DEG2RAD(CoordGeodetic.phi));

	/* compute the local radius of curvature on the WGS-84 reference ellipsoid */

	rc = Ellip->a / sqrt(1.0 - Ellip->epssq * SinLat * SinLat);

	/* compute ECEF Cartesian coordinates of specified point (for longitude=0) */

	xp = (rc + CoordGeodetic.HeightAboveEllipsoid) * CosLat;
	zp = (rc*(1.0 - Ellip->epssq) + CoordGeodetic.HeightAboveEllipsoid) * SinLat;

	/* compute spherical radius and angle lambda and phi of specified point */

	CoordSpherical->r = sqrt(xp * xp + zp * zp);
	CoordSpherical->phig = RAD2DEG(asin(zp / CoordSpherical->r));     /* geocentric latitude */
	CoordSpherical->lambda = CoordGeodetic.lambda;                   /* longitude */

	}/*WMM_GeodeticToSpherical*/

void WMM::WMM_TimelyModifyMagneticModel(WMMtype_Date UserDate)

	/* Time change the Model coefficients from the base year of the model using secular variation coefficients.
	Store the coefficients of the static model with their values advanced from epoch t0 to epoch t.
	Copy the SV coefficients.  If input "t?" is the same as "t0", then this is merely a copy operation.
	If the address of "TimedMagneticModel" is the same as the address of "MagneticModel", then this procedure overwrites
	the given item "MagneticModel".

	INPUT: UserDate
		   MagneticModel
	OUTPUT:TimedMagneticModel
	CALLS : none
	*/

	{
	int n, m, index, a, b;

	TimedMagneticModel->EditionDate = MagneticModel->EditionDate;
	TimedMagneticModel->epoch	    = MagneticModel->epoch;
    TimedMagneticModel->nMax	   	= MagneticModel->nMax;
	TimedMagneticModel->nMaxSecVar  = MagneticModel->nMaxSecVar;

	a = TimedMagneticModel->nMaxSecVar;
	b = (a * (a + 1) / 2 + a);

	strcpy(TimedMagneticModel->ModelName,MagneticModel->ModelName);
	
	for (n = 1; n <=  MagneticModel->nMax; n++)
	{
		for (m=0;m<=n;m++)
		{
			index = (n * (n + 1) / 2 + m);
			if(index <= b)
			{
				TimedMagneticModel->Main_Field_Coeff_H[index]   = MagneticModel->Main_Field_Coeff_H[index] + (UserDate.DecimalYear - MagneticModel->epoch) * MagneticModel->Secular_Var_Coeff_H[index];
				TimedMagneticModel->Main_Field_Coeff_G[index]   = MagneticModel->Main_Field_Coeff_G[index] + (UserDate.DecimalYear - MagneticModel->epoch) * MagneticModel->Secular_Var_Coeff_G[index];
				TimedMagneticModel->Secular_Var_Coeff_H[index]  = MagneticModel->Secular_Var_Coeff_H[index]; // We need a copy of the secular var coef to calculate secular change 
				TimedMagneticModel->Secular_Var_Coeff_G[index]  = MagneticModel->Secular_Var_Coeff_G[index];
			}
			else
			{
				TimedMagneticModel->Main_Field_Coeff_H[index] = MagneticModel->Main_Field_Coeff_H[index];
				TimedMagneticModel->Main_Field_Coeff_G[index] = MagneticModel->Main_Field_Coeff_G[index];
			}
		}
	}
} /* WMM_TimelyModifyMagneticModel */

double WMM::magneticDeclination(double longitude, double latitude, double year) {
	// Construct the Geodetic coordinate structure
	WMMtype_CoordGeodetic CoordGeodetic;
	CoordGeodetic.lambda = longitude;
	CoordGeodetic.phi = latitude;
	CoordGeodetic.HeightAboveGeoid = 0; // Sea level
	CoordGeodetic.GEOID = true; // Height above MSL
    WMM_ConvertGeoidToEllipsoidHeight(&CoordGeodetic);

	// Convert to spherical coordinates
	WMMtype_CoordSpherical CoordSpherical;
    WMM_GeodeticToSpherical(CoordGeodetic, &CoordSpherical);           /*Convert from geodeitic to Spherical Equations: 17-18, WMM Technical report*/

	WMMtype_Date UserDate;
	UserDate.DecimalYear = year;
    WMM_TimelyModifyMagneticModel(UserDate);                           /* Time adjust the coefficients, Equation 19, WMM Technical report */

	WMMtype_GeoMagneticElements GeoMagneticElements;
    WMM_Geomag(CoordSpherical, CoordGeodetic, &GeoMagneticElements);   /* Computes the geoMagnetic field elements and their time change*/

	return GeoMagneticElements.Decl;
}
