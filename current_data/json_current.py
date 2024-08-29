import json
import numpy as np
import matplotlib.pyplot as plt
import cartopy.crs as ccrs
import cartopy.feature as cfeature

with open("/Users/nickmarshall/jaia/current_data/cl_ri_2024-08-02_20.00.json") as file:
    data = json.load(file)

header = data[0]['header']
eastward = np.array(data[0]['data'])

ny = header['ny']
nx = header['nx']
lon_start, lon_end = header['lo1'], header['lo2']
lat_start, lat_end = header['la1'], header['la2']
dx, dy = header['dx'], header['dy']

eastward = eastward.reshape((ny, nx))

lon = np.linspace(lon_start, lon_end, nx)
lat = np.linspace(lat_start, lat_end, ny)

fig, ax = plt.subplots(figsize=(10, 8), subplot_kw={'projection': ccrs.PlateCarree()})

# Add map features
#ax.coastlines()
#ax.add_feature(cfeature.BORDERS)
#ax.add_feature(cfeature.LAND)
#ax.add_feature(cfeature.OCEAN)

# Plot the u-component (Eastward current)
lon_grid, lat_grid = np.meshgrid(lon, lat)
contour = ax.contourf(lon_grid, lat_grid, eastward, transform=ccrs.PlateCarree(), cmap='coolwarm')

quiver = ax.quiver(lon, lat, data, data, scale=75, scale_units='xy', width=0.003, headlength=5, headaxislength=7, transform=ccrs.PlateCarree(), color='black')

# Add a color bar
#plt.colorbar(contour, ax=ax, orientation='vertical', label='Eastward current (m/s)')

# Set the extent of the map to the region of interest
ax.set_extent([lon_start, lon_end, lat_start, lat_end])

plt.show()