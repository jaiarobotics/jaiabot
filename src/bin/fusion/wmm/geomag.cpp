// geomag.cpp : Defines the entry point for the console application.
//

#include "stdafx.h"

#include "WMM.h"
#include "geomag.h"

int _tmain(int, _TCHAR*)
{
	WMM Earth;
	CMD Console;

	WMMtype_CoordSpherical CoordSpherical;
	WMMtype_CoordGeodetic CoordGeodetic;
	WMMtype_Date UserDate;
	WMMtype_GeoMagneticElements GeoMagneticElements;

	char ans[20];
	int Flag = 1;

	Console.WMM_GeomagIntroduction(Earth.WMM_GetEpoch());  /* Print out the WMM introduction */

	while (Flag == 1) {
		if(Console.WMM_GetUserInput(&CoordGeodetic, &UserDate, Earth.WMM_GetEpoch()) == 1)    	             /*Get User Input */
		{

			Earth.WMM_ConvertGeoidToEllipsoidHeight(&CoordGeodetic);
			Earth.WMM_GeodeticToSpherical(CoordGeodetic, &CoordSpherical);           /*Convert from geodeitic to Spherical Equations: 17-18, WMM Technical report*/
			Earth.WMM_TimelyModifyMagneticModel(UserDate);                           /* Time adjust the coefficients, Equation 19, WMM Technical report */
			Earth.WMM_Geomag(CoordSpherical, CoordGeodetic, &GeoMagneticElements);   /* Computes the geoMagnetic field elements and their time change*/
			
			Console.WMM_PrintUserData(GeoMagneticElements,CoordGeodetic, UserDate, Earth.WMM_GetEpoch(), Earth.WMM_GetSecularVariationUsed());  /* Print the results */
		}
	  printf("\n\n Do you need more point data ? (y or n) \n ");
	  fgets(ans, 20, stdin);
				switch(ans[0])
				{
					case 'Y':
					case 'y':
						Flag = 1;
						break;
					case 'N':
					case 'n':
						Flag = 0;
						break;
					default:
						Flag = 0;
						break;
				}

		}


return 0;
}

char CMD::WMM_GeomagIntroduction(double epoch)
	/*Prints the introduction to the Geomagnetic program.  It needs the Magnetic model for the epoch.

	* INPUT  MagneticModel		: WMMtype_MagneticModel With Model epoch 	(input)
	  OUTPUT ans   (char)  user selection  (I don't think so, gp)
	  CALLS : none
	*/
	{
	char help = 'h';
	printf("\n\n Welcome to the World Magnetic Model (WMM) %d C-Program\n\n", epoch);
	printf("            --- Version 0.3, DATE Nov 23, 2009 ---\n\n");
	printf("\n This program estimates the strength and direction of ");
	printf("\n Earth's main Magnetic field for a given point/area.");
	while(help != 'c' && help != 'C')
	{
		printf("\n Enter h for help and contact information or c to continue.");
		printf ("\n >");
		scanf("%c%*[^\n]",&help);
		getchar();

		if ((help == 'h') || (help == 'H'))
		{
			printf("\n Help information ");

			printf("\n The World Magnetic Model (WMM) for %lf", epoch);
			printf("\n is a model of Earth's main Magnetic field.  The WMM");
			printf("\n is recomputed every five (5) years, in years divisible by ");
			printf("\n five (i.e. 2005, 2010).  See the contact information below");
			printf("\n to obtain more information on the WMM and associated software.");
			printf("\n ");
			printf("\n Input required is the location in geodetic latitude and");
			printf("\n longitude (positive for northern latitudes and eastern ");
			printf("\n longitudes), geodetic altitude in meters, and the date of ");
			printf("\n interest in years.");

			printf("\n\n\n The program computes the estimated Magnetic Declination");
			printf("\n (Decl) which is sometimes called MagneticVAR, Inclination (Incl), Total");
			printf("\n Intensity (F or TI), Horizontal Intensity (H or HI), Vertical");
			printf("\n Intensity (Z). Declination and Grid");
			printf("\n Variation are measured in units of degrees and are considered");
			printf("\n positive when east or north.  Inclination is measured in units");
			printf("\n of degrees and is considered positive when pointing down (into");
			printf("\n the Earth).  The WMM is reference to the WGS-84 ellipsoid and");
			printf("\n is valid for 5 years after the base epoch.");

			printf("\n\n\n It is very important to note that a  degree and  order 12 model,");
			printf("\n such as WMM, describes only the long  wavelength spatial Magnetic ");
			printf("\n fluctuations due to  Earth's core.  Not included in the WMM series");
			printf("\n models are intermediate and short wavelength spatial fluctuations ");
			printf("\n that originate in Earth's mantle and crust. Consequently, isolated");
			printf("\n angular errors at various  positions on the surface (primarily over");
			printf("\n land, incontinental margins and  over oceanic seamounts, ridges and");
			printf("\n trenches) of several degrees may be expected.  Also not included in");
			printf("\n the model are temporal fluctuations of Magneticnetospheric and ionospheric");
			printf("\n origin. On the days during and immediately following Magnetic storms,");
			printf("\n temporal fluctuations can cause substantial deviations of the Geomagnetic");
			printf("\n field  from model  values.  If the required  declination accuracy  is");
			printf("\n more stringent than the WMM  series of models provide, the user is");
			printf("\n advised to request special (regional or local) surveys be performed");
			printf("\n and models prepared. Please make requests of this nature to the");
			printf("\n National Geospatial-Intelligence Agency (NGA) at the address below.");

			printf("\n\n\n Contact Information");

			printf("\n  Software and Model Support");
			printf("\n	National Geophysical Data Center");
			printf("\n	NOAA EGC/2");
			printf("\n	325 Broadway");
			printf("\n	Boulder, CO 80303 USA");
			printf("\n	Attn: Manoj Nair or Stefan Maus");
			printf("\n	Phone:  (303) 497-6522 or -6522");
			printf("\n	Email:  Manoj.C.Nair@noaa.gov or Stefan.Maus@noaa.gov \n");
		}
	}
		return '\0';
	} /*WMM_GeomagIntroduction*/

int CMD::WMM_GetUserInput(WMMtype_CoordGeodetic *CoordGeodetic, WMMtype_Date *MagneticDate, double epoch)

	/*
	This prompts the user for coordinates, and accepts many entry formats.
	It takes the MagneticModel and Geoid as input and outputs the Geographic coordinates and Date as objects.
	Returns 0 when the user wants to exit and 1 if the user enters valid input data.
	INPUT :  MagneticModel  : Data structure with the following elements used here
				double epoch;       Base time of Geomagnetic model epoch (yrs)
			: Geoid Pointer to data structure WMMtype_Geoid (used for converting HeightAboveGeoid to HeightABoveEllipsoid

	OUTPUT: CoordGeodetic : Pointer to data structure. Following elements are updated
				double lambda; (longitude)
				double phi; ( geodetic latitude)
				double HeightAboveEllipsoid; (height above the ellipsoid (HaE) )
				double HeightAboveGeoid;(height above the Geoid )

			MagneticDate : Pointer to data structure WMMtype_Date with the following elements updated
				int	Year; (If user directly enters decimal year this field is not populated)
				int	Month;(If user directly enters decimal year this field is not populated)
				int	Day; (If user directly enters decimal year this field is not populated)
				double DecimalYear;      decimal years

	CALLS: 	WMM_DMSstringToDegree(buffer, &CoordGeodetic->lambda); (The program uses this to convert the string into a decimal longitude.)
			WMM_ValidateDMSstringlong(buffer, Error_Message)
			WMM_ValidateDMSstringlat(buffer, Error_Message)
			WMM_Warnings
			WMM_ConvertGeoidToEllipsoidHeight
			WMM_DateToYear

	*/

	{
	char Error_Message[255];
	char buffer[40];
	char tmp;
	int i, j, a, b, c, done = 0;
	strcpy(buffer, "");/*Clear the input    */
	printf("\nPlease enter latitude");
	printf("\nNorth Latitude positive, For example:");
	printf("\n30, 30, 30 (D,M,S) or 30.508 (Decimal Degrees) (both are north)\n");
	fgets(buffer, 40, stdin);
	for(i = 0, done = 0, j = 0; i<= 40 && !done; i++)
	{
		if(buffer[i] == '.')
		{
			j = sscanf(buffer, "%lf", &CoordGeodetic->phi);
			if (j == 1)
				done = 1;
			else
				done = -1;
		}
		if(buffer[i] == ',')
		{
			if(WMM_ValidateDMSstringlat(buffer, Error_Message))
			{
				WMM_DMSstringToDegree(buffer, &CoordGeodetic->phi);
				done = 1;
			}
			else
				done = -1;
		}
		if(buffer[i] == ' ')/* This detects if there is a ' ' somewhere in the string,
		if there is the program tries to interpret the input as Degrees Minutes Seconds.*/
		{
			if(WMM_ValidateDMSstringlat(buffer, Error_Message))
			{
				WMM_DMSstringToDegree(buffer, &CoordGeodetic->phi);
				done = 1;
			}
			else
				done = -1;
		}
		if(buffer[i] == '\0' || done == -1)
		{
			if(WMM_ValidateDMSstringlat(buffer, Error_Message) && done != -1)
			{
				sscanf(buffer, "%lf", &CoordGeodetic->phi);
				done = 1;
			}
			else
			{
				printf("%s", Error_Message);
				strcpy(buffer, "");
				printf("\nError encountered, please re-enter as '(-)DDD,MM,SS' or in Decimal Degrees DD.ddd:\n");
				fgets(buffer, 40, stdin);
				i = -1;
				done = 0;
			}
		}
		if(done && abs(CoordGeodetic->phi) == 90)
		{
			switch(WMM_Warnings(3, CoordGeodetic->phi, epoch))
			{
				case 0:
					return 0;
					break;
				case 1:
					done = 0;
					i = -1;
					strcpy(buffer, "");/*Clear the input*/
					printf("Please enter latitude:");
					fgets(buffer, 40, stdin);
					break;
				case 2:
					break;
			}
		}
	}
	strcpy(buffer, "");/*Clear the input*/
	printf("\nPlease enter longitude");
	printf("\nEast longitude positive, West negative.  For example:");
	printf("\n-100.5 or -100, 30, 0 for 100.5 degrees west\n");
	fgets(buffer, 40, stdin);
	for(i = 0, done = 0, j = 0; i <= 40 && !done; i++)/*This for loop determines how the user is trying to enter their data, and makes sure that it is copied into the correct location*/
	{
		if(buffer[i] == '.') /*This detects if there is a '.' somewhere in the string, if there is the program tries to interpret the input as a double, and copies it to the longitude*/
		{
			j = sscanf(buffer, "%lf", &CoordGeodetic->lambda);
			if(j == 1)
				done = 1;/*This control ends the loop*/
			else
				done = -1; /*This copies an end string into the buffer so that the user is sent to the Re-enter input message*/
		}
		if(buffer[i] == ',')/*This detects if there is a ',' somewhere in the string, if there is the program tries to interpret the input as Degrees, Minutes, Seconds.*/
		{
			if(WMM_ValidateDMSstringlong(buffer, Error_Message))
			{
				WMM_DMSstringToDegree(buffer, &CoordGeodetic->lambda); /*The program uses this to convert the string into a decimal longitude.*/
				done = 1;
			}
			else
				done = -1;
		}
		if(buffer[i] == ' ')/* This detects if there is a ' ' somewhere in the string, if there is the program tries to interpret the input as Degrees Minutes Seconds.*/
		{
			if(WMM_ValidateDMSstringlong(buffer, Error_Message))
			{
				WMM_DMSstringToDegree(buffer, &CoordGeodetic->lambda);
				done = 1;
			}
			else
				done = -1;
		}
		if(buffer[i] == '\0' || done == -1) /*If the program reaches the end of the string before finding a "." or a "," or if its been sent by an error it does this*/
		{
			WMM_ValidateDMSstringlong(buffer, Error_Message);/*The program attempts to determine if all the characters in the string are legal, and then tries to interpret the string as a simple degree entry, like "0", or "67"*/
			if(WMM_ValidateDMSstringlong(buffer, Error_Message) && done != -1)
			{
				sscanf(buffer, "%lf", &CoordGeodetic->lambda);
				done = 1;
			}
			else /*The string is neither DMS, a decimal degree, or a simple degree input, or has some error*/
			{
				printf("%s", Error_Message);
				strcpy(buffer, "");/*Clear the input*/
				printf("\nError encountered, please re-enter as '(-)DDD,MM,SS' or in Decimal Degrees DD.ddd:\n"); /*Request new input*/
				fgets(buffer, 40, stdin);
				i = -1; /*Restart the loop, at the end of this loop i will be incremented to 0, effectively restarting the loop*/
				done = 0;
			}
		}
	}
	printf("\nPlease enter height above mean sea level (in kilometers):\n[For height above WGS-84 Ellipsoid prefix E, for example (E20.1)]\n");
	done = 0;
	while(!done)
	{
		strcpy(buffer, "");
		fgets(buffer, 40, stdin);
		j = 0;
		if(buffer[0] == 'e' || buffer[0] == 'E')   /* User entered height above WGS-84 ellipsoid, copy it to CoordGeodetic->HeightAboveEllipsoid */
		{
			j = sscanf(buffer, "%c%lf", &tmp, &CoordGeodetic->HeightAboveGeoid);
			CoordGeodetic->GEOID = false;
			if (j == 2)	j = 1;
		}
		else  /* User entered height above MSL, convert it to the height above WGS-84 ellipsoid */
		{
			j = sscanf(buffer, "%lf", &CoordGeodetic->HeightAboveGeoid);
			CoordGeodetic->GEOID = true;
		}
		if (j == 1)
			done = 1;
		else
			printf("\nIllegal Format, please re-enter as '(-)HHH.hhh:'\n");
		if((CoordGeodetic->HeightAboveGeoid > 1000.0 || CoordGeodetic->HeightAboveGeoid < -10.0) && done == 1)
			switch(WMM_Warnings(4, CoordGeodetic->HeightAboveEllipsoid, epoch))
			{
				case 0:
					return 0;
					break;
				case 1:
					done = 0;
					printf("Please enter height above sea level (in kilometers):\n");
					break;
				case 2:
					break;
			}
	}
	strcpy(buffer, "");
	printf("\nPlease enter the decimal year or calendar date\n (YYYY.yyy, MM DD YYYY or MM/DD/YYYY):\n");
	fgets(buffer, 40, stdin);
	for(i = 0, done = 0; i <= 40 && !done; i++)
	{
		if(buffer[i] == '.')
		{
			j = sscanf(buffer, "%lf", &MagneticDate->DecimalYear);
			if(j == 1)
				done = 1;
			else
				buffer[i] = '\0';
		}
		if(buffer[i] == '/')
		{
			sscanf(buffer, "%d/%d/%d", &MagneticDate->Month, &MagneticDate->Day, &MagneticDate->Year);
			if(!WMM_DateToYear(MagneticDate, Error_Message))
			{
				printf(Error_Message);
				printf("\nPlease re-enter Date in MM/DD/YYYY or MM DD YYYY format, or as a decimal year\n");
				fgets(buffer, 40, stdin);
				i = 0;
			}
			else
				done = 1;
		}
		if((buffer[i] == ' ' && buffer[i+1] != '/') || buffer[i] == '\0')
		{
			if (3 == sscanf(buffer, "%d %d %d", &a, &b, &c))
			{
				MagneticDate->Month = a;
				MagneticDate->Day = b;
				MagneticDate->Year = c;
			}
			else if(1 == sscanf(buffer, "%d %d %d", &a, &b, &c))
			{
				MagneticDate->DecimalYear = a;
				done = 1;
				//printf("%lf\n", MagneticDate->DecimalYear);
			}
			if(!(MagneticDate->DecimalYear == a))
			{
				if(!WMM_DateToYear(MagneticDate, Error_Message))
				{
					printf(Error_Message);
					strcpy(buffer, "");
					printf("\nError encountered, please re-enter Date in MM/DD/YYYY or MM DD YYYY format, or as a decimal year\n");
					fgets(buffer, 40, stdin);
					i = -1;
				}
				else
				done = 1;
			}
		}
		if(buffer[i] == '\0' && i != -1 && done != 1)
		{
			strcpy(buffer, "");
			printf("\nError encountered, please re-enter as MM/DD/YYYY, MM DD YYYY, or as YYYY.yyy:\n");
			fgets(buffer, 40, stdin);
			i = -1;
		}
		if(done)
		{
			if(MagneticDate->DecimalYear > epoch + 5 ||MagneticDate->DecimalYear < epoch)
			{
				switch(WMM_Warnings(5, MagneticDate->DecimalYear, epoch))
				{
					case 0:
						return 0;
						break;
					case 1:
						done = 0;
						i = -1;
						strcpy(buffer, "");
						printf("\nPlease enter the decimal year or calendar date\n (YYYY.yyy, MM DD YYYY or MM/DD/YYYY):\n");
						fgets(buffer, 40, stdin);
						break;
					case 2:
						break;
				}
			}
		}
	}
	return 1;
	} /*WMM_GetUserInput*/

int CMD::WMM_ValidateDMSstringlat(char *input, char *Error)

	/* Validates a latitude DMS string, and returns 1 for a success and returns 0 for a failure.
	It copies an error message to the Error string in the event of a failure.

	INPUT : input (DMS string)
	OUTPUT : Error : Error string
	CALLS : none
	*/

{
	int degree, minute, second, j = 0, n, max_minute = 60, max_second = 60;
	int i;
	degree = -1000;
	minute = -1;
	second = -1;
	n = (int)strlen(input);

	for (i = 0; i <= n-1; i++) //tests for legal characters
	{
		if ((input[i] < '0'|| input[i] > '9') && (input[i] != ',' && input[i]!=' ' && input[i] != '-' && input[i] != '\0' && input[i] != '\n'))
		{
			strcpy(Error, "\nError: Input contains an illegal character, legal characters for Degree, Minute, Second format are:\n '0-9' ',' '-' '[space]' '[Enter]'\n");
			return 0;
		}
		if(input[i] == ',')
			j++;
	}
	if(j == 2)
		j = sscanf(input, "%d, %d, %d", &degree, &minute, &second);  //tests for legal formatting and range
	else
		j = sscanf(input, "%d %d %d", &degree, &minute, &second);
	if(j == 1)
	{
		minute = 0;
		second = 0;
		j = 3;
	}
	if(j != 3)
	{
		strcpy(Error, "\nError: Not enough numbers used for Degrees, Minutes, Seconds format\n or they were incorrectly formatted\n The legal format is DD,MM,SS or DD MM SS\n");
		return 0;
	}
	if (degree > 90 || degree < -90)
	{
		strcpy(Error, "\nError: Degree input is outside legal range for latitude\n The legal range is from -90 to 90\n");
		return 0;
	}
	if(abs(degree) == 90)
		max_minute = 0;
	if (minute > max_minute || minute < 0)
	{
		strcpy(Error, "\nError: Minute input is outside legal range\n The legal minute range is from 0 to 60\n");
		return 0;
	}
	if(minute == max_minute)
		max_second = 0;
	if (second > max_second || second < 0)
	{
		strcpy(Error, "\nError: Second input is outside legal range\n The legal second range is from 0 to 60\n");
		return 0;
	}
	return 1;
	} /*WMM_ValidateDMSstringlat*/

void CMD::WMM_DMSstringToDegree (char *DMSstring, double *DegreesOfArc)

	/*This converts a given DMS string into decimal degrees.
	INPUT  DMSstring 	 pointer to DMSString
	OUTPUT  DegreesOfArc   decimal degree
	CALLS : none
	*/

	{
	int second, minute, degree, sign = 1, j = 0;
	j = sscanf(DMSstring, "%d, %d, %d", &degree, &minute, &second);
	if (j != 3)
		sscanf(DMSstring, "%d %d %d", &degree, &minute, &second);
	if(degree < 0)
		sign = -1;
	degree = degree * sign;
	*DegreesOfArc = sign * (degree + minute / 60.0 + second / 3600.0);
	} /*WMM_DMSstringToDegree*/

int CMD::WMM_Warnings(int control, double value, double epoch)

	/*Return value 0 means end program, Return value 1 means get new data, Return value 2 means continue.
	  This prints a warning to the screen determined by the control integer. It also takes the value of the parameter causing the warning as a double.  This is unnecessary for some warnings.
	  It requires the MagneticModel to determine the current epoch.

	 INPUT control :int : (Warning number)
			value  : double: Magnetic field strength
			MagneticModel
	OUTPUT : none
	CALLS : none

	  */

	{
	char ans[20];
	strcpy(ans, "");
	switch(control)
	{
		case 1://Horizontal Field strength low
			printf("\nWarning: The Horizontal Field strength at this location is only %lf\n", value);
			printf("	Compass readings have large uncertainties in areas where H\n	is smaller than 5000 nT\n");
			printf("Press enter to continue...\n");
			fgets(ans, 20, stdin);
			break;
		case 2://Horizontal Field strength very low
			printf("\nWarning: The Horizontal Field strength at this location is only %lf\n", value);
			printf("	Compass readings have VERY LARGE uncertainties in areas where\n	where H is smaller than 1000 nT\n");
			printf("Press enter to continue...\n");
			fgets(ans, 20, stdin);
			break;
		case 3://Location at geographic pole.
			printf("\nWarning: Location is at geographic pole where X, Y, and Declination are undefined\n");
			while(1)
			{
				printf("\nPlease press 'C' to continue, 'G' to get new data or 'X' to exit...\n");
				fgets(ans, 20, stdin);
				switch(ans[0])
				{
					case 'X':
					case 'x':
						return 0;
					case 'G':
					case 'g':
						return 1;
					case 'C':
					case 'c':
						return 2;
					default:
						printf("Invalid input %c\n", ans[0]);
						break;
				}
			}
		case 4:/*Elevation outside the recommended range.*/
			printf("\nWarning: The value you have entered of %lf km for the elevation is outside of the recommended range.\n Elevations between -10.0 km and 1000.0 km are recommended for more accurate results. \n", value);
			while(1)
			{
				printf("\nPlease press 'C' to continue, 'G' to get new data or 'X' to exit...\n");
				fgets(ans, 20, stdin);
				switch(ans[0])
				{
					case 'X':
					case 'x':
						return 0;
					case 'G':
					case 'g':
						return 1;
					case 'C':
					case 'c':
						return 2;
					default:
						printf("\nInvalid input %c\n", ans[0]);
						break;
				}
			}
			break;

		case 5:/*Date outside the recommended range*/
			printf("\nWARNING - TIME EXTENDS BEYOND MODEL 5-YEAR LIFE SPAN\n CONTACT NGDC FOR PRODUCT UPDATES:\n");
			printf("	National Geophysical Data Center\n");
			printf("	NOAA EGC/2\n");
			printf("	325 Broadway\n");
			printf("	Attn: Manoj Nair or Stefan Maus\n");
			printf("	Phone:	(303) 497-4642 or -6522\n");
			printf("	Email:	Manoj.C.Nair@noaa.gov\n");
			printf("	or\n");
			printf("	Stefan.Maus@noaa.gov\n");
			printf("	Web: http://www.ngdc.noaa.gov/Geomagnetic/WMM/DoDWMM.shtml\n");
			printf("\n EPOCH  = %d - %d\n" , epoch, epoch + 5);
			printf(" TIME   = %lf\n", value);
			while(1)
			{
				printf("\nPlease press 'C' to continue, 'N' to enter new data or 'X' to exit...\n");
				fgets(ans, 20, stdin);
				switch(ans[0])
				{
					case 'X':
					case 'x':
						return 0;
					case 'N':
					case 'n':
						return 1;
					case 'C':
					case 'c':
						return 2;
					default:
						printf("\nInvalid input %c\n", ans[0]);
						break;
				}
			}
			break;
	}
	return 2;
} /*WMM_Warnings*/

void CMD::WMM_PrintUserData(WMMtype_GeoMagneticElements GeomagElements, WMMtype_CoordGeodetic SpaceInput, WMMtype_Date TimeInput, double epoch, int SecularVariationUsed)
	/* This function prints the results in  Geomagnetic Elements for a point calculation. It takes the calculated
	*  Geomagnetic elements "GeomagElements" as input.
	*  As well as the coordinates, date, and Magnetic Model.
	INPUT :  GeomagElements : Data structure WMMtype_GeoMagneticElements with the following elements
				double Decl; (Angle between the magnetic field vector and true north, positive east)
				double Incl; Angle between the magnetic field vector and the horizontal plane, positive down
				double F; Magnetic Field Strength
				double H; Horizontal Magnetic Field Strength
				double X; Northern component of the magnetic field vector
				double Y; Eastern component of the magnetic field vector
				double Z; Downward component of the magnetic field vector4
				double Decldot; Yearly Rate of change in declination
				double Incldot; Yearly Rate of change in inclination
				double Fdot; Yearly rate of change in Magnetic field strength
				double Hdot; Yearly rate of change in horizontal field strength
				double Xdot; Yearly rate of change in the northern component
				double Ydot; Yearly rate of change in the eastern component
				double Zdot; Yearly rate of change in the downward component
				double GVdot;Yearly rate of chnage in grid variation
		CoordGeodetic Pointer to the  data  structure with the following elements
				double lambda; (longitude)
				double phi; ( geodetic latitude)
				double HeightAboveEllipsoid; (height above the ellipsoid (HaE) )
				double HeightAboveGeoid;(height above the Geoid )
		TimeInput :  data structure WMMtype_Date with the following elements
				int	Year;
				int	Month;
				int	Day;
				double DecimalYear;      decimal years
		MagneticModel :	 data structure with the following elements
				double EditionDate;
				double epoch;       Base time of Geomagnetic model epoch (yrs)
				char  ModelName[20];
				double *Main_Field_Coeff_G;          C - Gauss coefficients of main geomagnetic model (nT)
				double *Main_Field_Coeff_H;          C - Gauss coefficients of main geomagnetic model (nT)
				double *Secular_Var_Coeff_G;  CD - Gauss coefficients of secular geomagnetic model (nT/yr)
				double *Secular_Var_Coeff_H;  CD - Gauss coefficients of secular geomagnetic model (nT/yr)
				int nMax;  Maximum degree of spherical harmonic model
				int nMaxSecVar; Maxumum degree of spherical harmonic secular model
				int SecularVariationUsed; Whether or not the magnetic secular variation vector will be needed by program
		OUTPUT : none


	*/
{
	char DeclString[100];
	char InclString[100];
	WMM_DegreeToDMSstring(GeomagElements.Incl, 2, InclString);
	if(GeomagElements.H < 5000 && GeomagElements.H > 1000)	WMM_Warnings(1, GeomagElements.H, epoch);
	if(GeomagElements.H < 1000)	WMM_Warnings(2, GeomagElements.H, epoch);
	if(SecularVariationUsed == 1)
	{
		if(abs(SpaceInput.phi) == 90)
		{
			printf("\n Results For \n\n");
			if(SpaceInput.phi < 0)
				printf("Latitude	%.2lfS\n", -SpaceInput.phi);
			else
				printf("Latitude	%.2lfN\n", SpaceInput.phi);
			if(SpaceInput.lambda < 0)
				printf("Longitude	%.2lfW\n", -SpaceInput.lambda);
			else
				printf("Longitude	%.2lfE\n", SpaceInput.lambda);
			printf("Altitude:	%.2lf Kilometers\n", SpaceInput.HeightAboveGeoid);
			printf("Date:		%.2lf\n", TimeInput.DecimalYear);
			printf("\n	Main Field\t\t\tSecular Change\n");
			printf("F	=	%-9.1lf nT\t\t  dF = %.1lf\tnT/yr\n", GeomagElements.F, GeomagElements.Fdot);
			printf("H	=	%-9.1lf nT\t\t  dH = %.1lf\tnT/yr\n", GeomagElements.H, GeomagElements.Hdot);
			printf("X	=	NAN nT\t\t\t  dX = NAN\tnT/yr\n");
			printf("Y	=	NAN nT\t\t\t  dY = NAN\tnT/yr\n");
			printf("Z	=	%-9.1lf nT\t\t  dZ = %.1lf\tnT/yr\n", GeomagElements.Z, GeomagElements.Zdot);
			printf("Decl	=	NAN Deg\t\t\t  dD = NAN\tDeg/yr\n");
			if(GeomagElements.Incl < 0)
				printf("Incl	=	%12s (UP)\t  dI = %.1lf\tMin/yr\n", InclString, 60 * GeomagElements.Incldot);
			else
				printf("Incl	=	%13s (DOWN)\t  dI = %.1lf\tMin/yr\n", InclString, 60 * GeomagElements.Incldot);
		}
		else
		{
			WMM_DegreeToDMSstring(GeomagElements.Decl, 2, DeclString);
			printf("\n Results For \n\n");
			if(SpaceInput.phi < 0)
				printf("Latitude	%.2lfS\n", -SpaceInput.phi);
			else
				printf("Latitude	%.2lfN\n", SpaceInput.phi);
			if(SpaceInput.lambda < 0)
				printf("Longitude	%.2lfW\n", -SpaceInput.lambda);
			else
				printf("Longitude	%.2lfE\n", SpaceInput.lambda);
			printf("Altitude:	%.2lf Kilometers\n", SpaceInput.HeightAboveGeoid);
			printf("Date:		%.1lf\n", TimeInput.DecimalYear);
			printf("\n		Main Field\t\t\tSecular Change\n");
			printf("F	=	%-9.1lf nT\t\t  dF = %.1lf\tnT/yr\n", GeomagElements.F, GeomagElements.Fdot);
			printf("H	=	%-9.1lf nT\t\t  dH = %.1lf\tnT/yr\n", GeomagElements.H, GeomagElements.Hdot);
			printf("X	=	%-9.1lf nT\t\t  dX = %.1lf\tnT/yr\n", GeomagElements.X, GeomagElements.Xdot);
			printf("Y	=	%-9.1lf nT\t\t  dY = %.1lf\tnT/yr\n", GeomagElements.Y, GeomagElements.Ydot);
			printf("Z	=	%-9.1lf nT\t\t  dZ = %.1lf\tnT/yr\n", GeomagElements.Z, GeomagElements.Zdot);
			if(GeomagElements.Decl < 0)
				printf("Decl	=%20s  (WEST)\t  dD = %.1lf\tMin/yr\n", DeclString, 60 * GeomagElements.Decldot);
			else
				printf("Decl	=%20s  (EAST)\t  dD = %.1lf\tMin/yr\n", DeclString, 60 * GeomagElements.Decldot);
			if(GeomagElements.Incl < 0)
				printf("Incl	=%20s  (UP)\t  dI = %.1lf\tMin/yr\n", InclString, 60 * GeomagElements.Incldot);
			else
				printf("Incl	=%20s  (DOWN)\t  dI = %.1lf\tMin/yr\n", InclString, 60 * GeomagElements.Incldot);
		}
	}
	else
	{
			if(abs(SpaceInput.phi) == 90)
		{
			printf("\n Results For \n\n");
			if(SpaceInput.phi < 0)
				printf("Latitude	%.2lfS\n", -SpaceInput.phi);
			else
				printf("Latitude	%.2lfN\n", SpaceInput.phi);
			if(SpaceInput.lambda < 0)
				printf("Longitude	%.2lfW\n", -SpaceInput.lambda);
			else
				printf("Longitude	%.2lfE\n", SpaceInput.lambda);
			printf("Altitude:	%.2lf Kilometers\n", SpaceInput.HeightAboveGeoid);
			printf("Date:		%.2lf\n", TimeInput.DecimalYear);
			printf("\n	Main Field\n");
			printf("F	=	%.1lf nT\n", GeomagElements.F);
			printf("H	=	%.1lf nT\n", GeomagElements.H);
			printf("X	=	NAN nT\n");
			printf("Y	=	NAN nT\n");
			printf("Z	=	%.1lf nT\n", GeomagElements.Z);
			printf("Decl	=	NAN Degrees\n");
			if(GeomagElements.Incl < 0)
				printf("Incl	=%20s  (UP)\n", InclString);
			else
				printf("Incl	=%20s  (DOWN)\n", InclString);
		}
		else
		{
			WMM_DegreeToDMSstring(GeomagElements.Decl, 2, DeclString);
			printf("\n Results For \n\n");
			if(SpaceInput.phi < 0)
				printf("Latitude	%.2lfS\n", -SpaceInput.phi);
			else
				printf("Latitude	%.2lfN\n", SpaceInput.phi);
			if(SpaceInput.lambda < 0)
				printf("Longitude	%.2lfW\n", -SpaceInput.lambda);
			else
				printf("Longitude	%.2lfE\n", SpaceInput.lambda);
			printf("Altitude:	%.2lf Kilometers\n", SpaceInput.HeightAboveGeoid);
			printf("Date:		%.1lf\n", TimeInput.DecimalYear);
			printf("\n	Main Field\n");
			printf("F	=	%-9.1lf nT\n", GeomagElements.F);
			printf("H	=	%-9.1lf nT\n", GeomagElements.H);
			printf("X	=	%-9.1lf nT\n", GeomagElements.X);
			printf("Y	=	%-9.1lf nT\n", GeomagElements.Y);
			printf("Z	=	%-9.1lf nT\n", GeomagElements.Z);
			if(GeomagElements.Decl < 0)
				printf("Decl	=%20s  (WEST)\n", DeclString);
			else
				printf("Decl	=%20s  (EAST)\n", DeclString);
			if(GeomagElements.Incl < 0)
				printf("Incl	=%20s  (UP)\n", InclString);
			else
				printf("Incl	=%20s  (DOWN)\n", InclString);
		}
	}

}/*WMM_PrintUserData*/

int CMD::WMM_ValidateDMSstringlong(char *input, char *Error)

	/*Validates a given longitude DMS string and returns 1 for a success and returns 0 for a failure.
	It copies an error message to the Error string in the event of a failure.

     INPUT : input (DMS string)
	OUTPUT : Error : Error string
	CALLS : none

	*/

	{
	int degree, minute, second, j = 0, max_minute = 60, max_second = 60, n;
	int i;
	degree = -1000;
	minute = -1;
	second = -1;
	n = (int)strlen(input);

	for (i = 0; i <= n-1; i++) //tests for legal characters
	{
		if ((input[i] < '0'|| input[i] > '9') && (input[i] != ',' && input[i]!=' ' && input[i] != '-' && input[i] != '\0' && input[i] != '\n'))
		{
			strcpy(Error, "\nError: Input contains an illegal character, legal characters for Degree, Minute, Second format are:\n '0-9' ',' '-' '[space]' '[Enter]'\n");
			return 0;
		}
		if(input[i] == ',')
			j++;
	}
	if(j >= 2)
		j = sscanf(input, "%d, %d, %d", &degree, &minute, &second);  //tests for legal formatting and range
	else
		j = sscanf(input, "%d %d %d", &degree, &minute, &second);
	if(j == 1)
	{
		minute = 0;
		second = 0;
		j = 3;
	}
	if(j != 3)
	{
		strcpy(Error, "\nError: Not enough numbers read for Degrees, Minutes, Seconds format\n or they were incorrectly formatted\n The legal format is DD,MM,SS or DD MM SS\n");
		return 0;
	}
	sscanf(input, "%d, %d, %d", &degree, &minute, &second);  //tests for legal formatting and range
	if (degree > 180 || degree < -180)
	{
		strcpy(Error, "\nError: Degree input is outside legal range\n The legal range is from -180 to 180\n");
		return 0;
	}
	if (abs(degree) == 180)
		max_minute = 0;
	if (minute > max_minute || minute < 0)
	{
		strcpy(Error, "\nError: Minute input is outside legal range\n The legal minute range is from 0 to 60\n");
		return 0;
	}
	if (minute == max_minute)
		max_second = 0;
	if (second > max_second || second < 0)
	{
		strcpy(Error, "\nError: Second input is outside legal range\n The legal second range is from 0 to 60\n");
		return 0;
	}
	return 1;
} /*WMM_ValidateDMSstringlong*/

int CMD::WMM_DateToYear (WMMtype_Date *CalendarDate, char *Error)

	/* Converts a given calendar date into a decimal year,
	it also outputs an error string if there is a problem
	INPUT  CalendarDate  Pointer to the  data  structure with the following elements
				int	Year;
				int	Month;
				int	Day;
				double DecimalYear;      decimal years
	OUTPUT  CalendarDate  Pointer to the  data  structure with the following elements updated
				double DecimalYear;      decimal years
			Error	pointer to an error string
	CALLS : none

	*/

	{
	int temp = 0; /*Total number of days */
	int MonthDays[13];
	int ExtraDay = 0;
	int i;
	if(CalendarDate->Year%4 == 0)
		ExtraDay = 1;
	MonthDays[0] = 0;
	MonthDays[1] = 31;
	MonthDays[2] = 28 + ExtraDay;
	MonthDays[3] = 31;
	MonthDays[4] = 30;
	MonthDays[5] = 31;
	MonthDays[6] = 30;
	MonthDays[7] = 31;
	MonthDays[8] = 31;
	MonthDays[9] = 30;
	MonthDays[10] = 31;
	MonthDays[11] = 30;
	MonthDays[12] = 31;

	/******************Validation********************************/
	if(CalendarDate->Month <= 0 || CalendarDate->Month > 12)
	{
		strcpy(Error, "\nError: The Month entered is invalid, valid months are '1 to 12'\n");
		return 0;
	}
	if(CalendarDate->Day <= 0 || CalendarDate->Day > MonthDays[CalendarDate->Month])
	{
		printf("\nThe number of days in month %d is %d\n", CalendarDate->Month, MonthDays[CalendarDate->Month]);
		strcpy(Error, "\nError: The day entered is invalid\n");
		return 0;
	}
	/****************Calculation of t***************************/
	for(i = 1; i <= CalendarDate->Month; i++)
		temp+=MonthDays[i-1];
	temp+=CalendarDate->Day;
	CalendarDate->DecimalYear = CalendarDate->Year + (temp-1)/(365.0 + ExtraDay);
	return 1;
}  /*WMM_DateToYear*/


void CMD::WMM_DegreeToDMSstring (double DegreesOfArc, int UnitDepth, char *DMSstring)

	/*This converts a given decimal degree into a DMS string.
	INPUT  DegreesOfArc   decimal degree
		   UnitDepth	  ??
	OUPUT  DMSstring 	 pointer to DMSString
	CALLS : none
	*/

	{
	int DMS[3], i;
	double temp = DegreesOfArc;
	char tempstring[20] = "";
	char tempstring2[20] = "";
	strcpy(DMSstring, "");
	if(UnitDepth >= 3)
		WMM_Error(21);
	for(i = 0; i < UnitDepth; i++)
	{
		DMS[i] = (int) temp;
		switch(i)
		{
			case 0:
			strcpy(tempstring2, "Deg");
			break;
			case 1:
			strcpy(tempstring2, "Min");
			break;
			case 2:
			strcpy(tempstring2, "Sec");
			break;
		}
		temp = (temp - DMS[i])*60;
		if(i == UnitDepth - 1 && temp >= 30)
			DMS[i]++;
		sprintf(tempstring, "%4d%4s", DMS[i], tempstring2);
		strcat(DMSstring, tempstring);
	}
	} /*WMM_DegreeToDMSstring*/

void CMD::WMM_Error(int control)
	{
	switch(control)
	{
		case 1:
			printf("\nError allocating in WMM_AllocateLegendreFunctionMemory.\n");
			break;
		case 2:
			printf("\nError allocating in WMM_AllocateModelMemory.\n");
			break;
		case 3:
			printf("\nError allocating in WMM_InitializeGeoid\n");
			break;
		case 4:
			printf("\nError in setting default values.\n");
			break;
		case 5:
			printf("\nError initializing Geoid.\n");
			break;
		case 6:
			printf("\nError opening WMM.COF\n.");
			break;
		case 7:
			printf("\nError opening WMMSV.COF\n.");
			break;
		case 8:
			printf("\nError reading Magnetic Model.\n");
			break;
		case 9:
			printf("\nError printing Command Prompt introduction.\n");
			break;
		case 10:
			printf("\nError converting from geodetic co-ordinates to spherical co-ordinates.\n");
			break;
		case 11:
			printf("\nError in time modifying the Magnetic model\n");
			break;
		case 12:
			printf("\nError in Geomagnetic\n");
			break;
		case 13:
			printf("\nError printing user data\n");\
			break;
		case 14:
			printf("\nError allocating in WMM_SummationSpecial\n");
			break;
		case 15:
			printf("\nError allocating in WMM_SecVarSummationSpecial\n");
			break;
		case 16:
			printf("\nError in opening EGM9615.BIN file\n");
			break;
		case 17:
			printf("\nError: Latitude OR Longitude out of range in WMM_GetGeoidHeight\n");
			break;
		case 18:
			printf("\nError allocating in WMM_PcupHigh\n");
			break;
		case 19:
			printf("\nError allocating in WMM_PcupLow\n");
			break;
		case 20:
			printf("\nError opening coefficient file\n");
			break;
		case 21:
			printf("\nError: UnitDepth too large\n");
			break;
		case 22:
			printf("\nYour system needs Big endian version of EGM9615.BIN.  \n");
			printf("Please download this file from http://www.ngdc.noaa.gov/geomag/WMM/DoDWMM.shtml.  \n");
			printf("Replace the existing EGM9615.BIN file with the downloaded one\n");
			break;
	}
} /*WMM_Error*/

