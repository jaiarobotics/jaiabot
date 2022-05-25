class CMD
{
public:
	CMD(){};
   ~CMD(){};

	char WMM_GeomagIntroduction(double epoch);
	int WMM_GetUserInput(WMMtype_CoordGeodetic *CoordGeodetic, WMMtype_Date *MagneticDate, double epoch);
	void WMM_PrintUserData(WMMtype_GeoMagneticElements GeomagElements, WMMtype_CoordGeodetic SpaceInput, WMMtype_Date TimeInput, double epoch, int SecularVariationUsed);
	void WMM_Error(int control);

private:
	int WMM_ValidateDMSstringlat(char *input, char *Error);
	void WMM_DMSstringToDegree (char *DMSstring, double *DegreesOfArc);
	int WMM_Warnings(int control, double value, double epoch);
	int WMM_ValidateDMSstringlong(char *input, char *Error);
	int WMM_DateToYear (WMMtype_Date *CalendarDate, char *Error);
	void WMM_DegreeToDMSstring (double DegreesOfArc, int UnitDepth, char *DMSstring);
};