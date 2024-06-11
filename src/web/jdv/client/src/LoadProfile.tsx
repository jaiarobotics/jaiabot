import React = require("react");

import { PlotProfiles } from "./PlotProfiles";

type PlotSet = string[];

interface LoadProfileProps {
    did_select_plot_set: (plot_set: PlotSet) => undefined;
}

export default function LoadProfile(props: LoadProfileProps) {
    let plot_profiles = PlotProfiles.plot_profiles();

    var plot_profile_names = Object.keys(plot_profiles);
    plot_profile_names.sort();

    let option_elements = plot_profile_names.map((profile_name) => {
        return (
            <option value={profile_name} key={profile_name}>
                {profile_name}
            </option>
        );
    });

    var first_option_element = [
        <option value="none" key="nothing">
            Load Profile
        </option>,
    ];

    let all_option_elements = first_option_element.concat(option_elements);

    return (
        <select
            className="padded"
            onChange={(evt) => {
                let plot_profile_name = evt.target.value;

                if (!plot_profile_name) {
                    return;
                }

                let plot_set = plot_profiles[plot_profile_name];
                props.did_select_plot_set?.(plot_set);

                evt.target.value = "none";
            }}
        >
            {all_option_elements}
        </select>
    );
}
