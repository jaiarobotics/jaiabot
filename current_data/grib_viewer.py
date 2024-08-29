import xarray as xr
import numpy as np
import matplotlib.pyplot as plt
import pygrib
import json
import cartopy.crs as ccrs
import cartopy.feature as cfeature

if __name__ == '__main__':
    grib_file = '/Users/nickmarshall/jaia/current_data/cl_ri_20240801.GRIB'
    grbs = pygrib.open(grib_file)

    # Initialize variables to store u and v components
    u_data = None
    v_data = None
    lats, lons = None, None

    # Iterate through the GRIB messages
    for grb in grbs:
        if grb.parameterName == 'None U-component of current m s**-1':
            u_data = grb.values
            lats, lons = grb.latlons()
        elif grb.parameterName == 'None V-component of current m s**-1':
            v_data = grb.values
    """
    data_list = []
    for i in range(lats.shape[0]):
        for j in range(lons.shape[0]):
            data_entry = {
                'latitude': float(lats[i]),
                'longitude': float(lons[j]),
                'u_component': float(u_data[i, j]),
                'v_component': float(v_data[i, j])
            }
            data_list.append(data_entry)

    json_data = json.dumps(data_list, indent=2)
    
    with open('current_data.json', 'w') as json_file:
        json_file.write(json_data)
    """
    
    # Check if both u and v components were found
    if u_data is not None and v_data is not None:
        # Plotting the data
        fig = plt.figure(figsize=(10, 5))
        ax = fig.add_subplot(1, 1, 1, projection=ccrs.PlateCarree())

        # Plot the magnitude of the current as a background
        magnitude = np.sqrt(u_data**2 + v_data**2)
        contour = ax.contourf(lons, lats, magnitude, transform=ccrs.PlateCarree(), cmap='coolwarm')

        # Add the quiver plot to show the direction and strength of the current
        quiver = ax.quiver(lons, lats, u_data, v_data, scale=75, scale_units='xy', width=0.003, headlength=5, headaxislength=7, transform=ccrs.PlateCarree(), color='black')

        ax.coastlines()
        #ax.gridlines()

        #plt.title("V-component of Current")
        #plt.colorbar(contour, label=f'{grb.parameterName} ({grb.parameterUnits})')
        #plt.show()

        ax.set_axis_off()

        plt.savefig('current_vector_field.svg', format='svg', pad_inches=0, bbox_inches='tight', transparent=True)
        plt.show()
    else:
        print("U or V component not found in the GRIB file.")