import plotly.graph_objects as go
import plotly.subplots as subplots
from datetime import *

class BdrFile:

    def __init__(self, filename, real_datetime=None, data_time_s=0) -> None:
        f = open(filename)
        hostname = f.readline()
        for i in range(0, 4):
            f.readline()
        nrows = int(f.readline().split(' ')[1])

        keys = f.readline().split(' ')
        data = {k: [] for k in keys}

        float_fields = {'Milliseconds', 'Amps*100', 'RPM'}

        for row_number in range(0, nrows-1):
            fields = f.readline().split(' ')
            for i, val in enumerate(fields):
                key = keys[i]
                if key in float_fields:
                    val = float(val)

                if key == 'Amps*100':
                    key = 'Amps'
                    val /= 100

                if key == 'Milliseconds':
                    if real_datetime is not None:
                        val = real_datetime + timedelta(seconds=val/1000.0 - data_time_s)
                        key = 'time'
                    else:
                        val = val / 1000.0

                data.setdefault(key, []).append(val)
        
        print(keys)

        self.data = data
        self.filename = filename

    def show_chart(self):
        fig = subplots.make_subplots(specs=[[{"secondary_y": True}]])

        fig.update_yaxes(title_text='Amps*100')
        fig.update_yaxes(title_text='RPM', secondary_y=True)

        fig.add_trace(go.Scatter(x=self.data['Milliseconds'], y=self.data['Amps*100'], mode='lines', name='Amps*100'))
        fig.add_trace(go.Scatter(x=self.data['Milliseconds'], y=self.data['RPM'], mode='lines', name='RPM'), secondary_y=True)

        fig.show()


if __name__ == '__main__':
    # , real_datetime=datetime.fromisoformat('2022-02-16T09:30:44')
    bdr = BdrFile('/Users/edsanville/Sync/jaia/logs/bot2/bot/0/PierTest.bdr', real_datetime=datetime.fromisoformat('2022-02-16T09:30:44'), data_time_s=3745)

    bdr.show_chart()
    