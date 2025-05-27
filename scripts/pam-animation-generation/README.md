what you did 
where you where
--

work flow
* pull files (h5 and audio files) from bots
* create a recording directory
* within the recording directory create two folders (nodes and sources and also place a geotiff with a scale to serve as the background for the animation
* in the nodes folder, create a folder for each recorder (e.g. node_2, node_3, node_4)
* inside each recorder folder, place the h5 file and the series of audio recording files
* in the source folder, create a folder (named as you would like it to appear in the legend and include a color for the marker e.g. "Red Lightweight AUV") with a source h5 or csv with the headers (time	lat	lon	depth) and time = micro-seconds since the last epoch UTC (UNIX), lat and lon = decimal degrees, depth = meters
* run prepare sections on a recording folder with node subfolders to generate "_generated" selection tables for each series of recordings
* import audio files and selection tables to RAVEN 1) drag the files onto raven and then 2) drag the selction table into the selection panel
* turn off the waveform from the views panel so that they do not appear in the selection table when you save it
* save selection table with calculated inband power with "_inbandPower" in the name instead of "_generated"
* run the visualize script on the recording folder so that you can ID an acceptable threshold
* run animation script

save selection will save the active frequency and time window to a new .wav file and THEN u can use Audacity (free download - download it without the MUSE HUB) to change the playback speed to hear different frequencies ->>>>>> NVM just use the windows clip tool to screen record Raven playing back the sound at the rate you chose

----------------------

TODO

* CUI marker??

* visualize should have a line for the threshold

* Change name to PAM to visulization

* animated vis (have a moving time bar) on visualization 

* check for the correct selection table with inband power - if there are multiple I am not sure which one it will chose

* (add 1. different noise floors 1a. legend has to be manually sized 2. remove Raven Pro from the loop by calcauting inband powers - would need to concatinate the files and would also be good to be able to visulize signal 3. remove need to sort audio files by bots - add botIDfleetID (need this bc multiple bots collect at the same time and multiple fleets) to the file name to match time and ID to h5 then based on a time you could grab audio files from a single source)

----------------------
reference example files <\Jaia\Product Development - Documents\Field Operations\20250225 TOEE25_2 LOE1_1 Panama City Beach\TOEE25.2 LOE1.1 fleet 23 PAM acoustic data> and the <\Jaia\Product Development - Documents\Field Operations\20250225 TOEE25_2 LOE1_1 Panama City Beach\20250224-26 PAM fleet 23 logs>

D (hammerhead approach only) - DONE - found bot2 to have a much lower noise floor

B (picket line) - was NOT the picket line (picket line was 2/25 13:40 Eastern)

E is the picket line

F (group) hammerhead on surface

A (grouped) 
