from dataclasses import dataclass
import matplotlib.pyplot as plt
import matplotlib.tri as tri
import numpy as np
import io
import base64

np.random.seed(19680801)
npts = 30
ngridx = 100
ngridy = 200
x = np.random.uniform(-2, 2, npts)
y = np.random.uniform(-2, 2, npts)
z = x * np.exp(-x**2 - y**2)


@dataclass
class Bounds:
    x0: float = 0
    x1: float = 0
    y0: float = 0
    y1: float = 0


class ContourPlot:


    def __init__(self) -> None:
        # These are the geographical bounds of the plot
        self.bounds = Bounds()

        # This is the raw PNG data of the generated plot
        self.image_data = b''


    def update_with_data(self, x, y, z):
        '''
        Gets a dictionary with a base64-encoded contour plot, 
        along with the coordinates to place the image, in data space.
        '''

        fig = plt.figure()
        fig.set_size_inches((8, 8))
        ax = plt.Axes(fig, [0.1, 0.1, 0.9, 0.8])
        ax.set_axis_off()
        fig.add_axes(ax)

        # ----------
        # Tricontour
        # ----------
        # Directly supply the unordered, irregularly spaced coordinates
        # to tricontour.

        ax.tricontour(x, y, z, levels=14, linewidths=0.5, colors='k')
        cntr2 = ax.tricontourf(x, y, z, levels=14, cmap="RdBu_r")

        fig.colorbar(cntr2, ax=ax)
        ax.plot(x, y, 'ko', ms=3)

        # Get bounding box of x and y data
        xlim = (min(x), max(x))
        ylim = (min(y), max(y))

        ax.set(xlim=xlim, ylim=ylim)
        ax.set_title('Measured Depth')

        # Disable all axes
        plt.axis('off')

        # Write the png data to a bytes object
        b = io.BytesIO()
        plt.savefig(b, format='png', edgecolor=(0, 0, 0, 0))
        self.image_data = b.getvalue()
        plt.close()

        # Calculate the bounding box of the edge of the image (in terms of the x/y plane of the data)
        xlim = ax.get_xlim()
        ylim = ax.get_ylim()
        position = ax.get_position()

        # Get linear mapping between image coordinates and data coordinates
        # l_x = m_x * p_x + b_x
        # l_x: x in data space
        # p_x: x in image space

        m_x = (xlim[1] - xlim[0]) / (position.x1 - position.x0)
        b_x = xlim[0] - m_x * position.x0

        m_y = (ylim[1] - ylim[0]) / (position.y1 - position.y0)
        b_y = ylim[0] - m_y * position.y0

        # Get the image bounds in data coordinates
        self.bounds.x0 = b_x
        self.bounds.y0 = b_y
        self.bounds.x1 = m_x + b_x
        self.bounds.y1 = m_y + b_y


    def get_bounds(self):
        bounds = self.bounds

        return {
            'x0': bounds.x0,
            'y0': bounds.y0,
            'x1': bounds.x1,
            'y1': bounds.y1
        }

    def get_image(self):
        return self.image_data

