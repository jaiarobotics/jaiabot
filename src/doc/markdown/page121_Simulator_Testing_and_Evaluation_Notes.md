# Simulator Testing and Evaluation Notes

### Table of Contents:
- [Key](#key)
- [Test Cases And Observations](#test-cases-and-observations)
- [Suggestions For Improvement](#suggestions-for-improvement)

<br>
<a id="key"></a>

# Key:
#Key Note: (This key applies to two tables: "Test Cases & Observations" and "Suggestions for Improvement")

**Test Cases And Observations**
* **Test case**: The specific scenario or function tested in the simulator.
* **Expected outcome**: What I think will happen upon test case completion.
* **Actual Outcome**: What actually happens when executing test case in sim.
* **Issues/Errors**: Listing any issues or errors I notice when executing test cases.
* **Notes**: Additional insights, unanswered questions, or considerations for future testing and
improvements.

**Suggestions for Improvement**
* **Area**: Specific areas of the simulator that could need improvement.
* **Current Issue**: Detailing the issue, I see in sim that could be improved.
* **Suggested Improvement**: Proposed solution to the current issue.
* **Priority (Low, Medium, High)**: Indicates the urgency of suggested improvement.

<br>
<a id="test-cases-and-observations"></a>

# Test Cases And Observations Table:
<table>
  <tr>
    <th>Test Case</th>
    <th>Expected Outcome</th>
    <th>Actual Outcome</th>
    <th>Issues/Errors</th>
    <th>Notes</th>
  </tr>
  <tr>
    <td valign="top">Hover over all icons to check labels.</td>
    <td valign="top">Each icon displays a label.</td>
    <td valign="top">Each icon has labels, and the “Help” icon explains their functions except for “Reset Rotation,” “Zoom In,” and “Zoom Out.”</td>
    <td valign="top">No issues or errors.</td>
    <td valign="top">The labels for icons on the right of the interface are:  
      <ul>
        <li><strong>System Check All Bots</strong><br> 
          <img src="https://raw.githubusercontent.com/Kait211/Practice/main/System_Check_All_Bots.png" alt="System Check" />
        </li>
        <li><strong>Stop All Missions</strong><br> 
          <img src="https://raw.githubusercontent.com/Kait211/Practice/main/Stop%20All%20Missions.png" alt="Stop All Missions" />
        </li>
        <li><strong>Run All Missions</strong><br> 
          <img src="https://raw.githubusercontent.com/Kait211/Practice/main/Run%20All%20Missions.png" alt="Run All Missions" />
        </li>
        <li><strong>Download All</strong><br> 
          <img src="https://raw.githubusercontent.com/Kait211/Practice/main/Download%20All.png" alt="Download All" />
        </li>
        <li><strong>Undo</strong><br> 
          <img src="https://raw.githubusercontent.com/Kait211/Practice/main/Undo.png" alt="Undo" />
        </li>
        <li><strong>Help</strong><br> 
          <img src="https://raw.githubusercontent.com/Kait211/Practice/main/Help.png" alt="Help" />
        </li>
        <li><strong>Mission Panel</strong><br> 
          <img src="https://raw.githubusercontent.com/Kait211/Practice/main/Mission%20Panel.png" alt="Mission Panel" />
        </li>
        <li><strong>Add Rally Point</strong><br> 
          <img src="https://raw.githubusercontent.com/Kait211/Practice/main/Add%20Rally%20Point.png" alt="Add Rally Point" />
        </li>
        <li><strong>Edit Optimized Mission Survey</strong><br> 
          <img src="https://raw.githubusercontent.com/Kait211/Practice/main/Edit%20Optimized%20Mission%20Survey.png" alt="Edit Optimized Mission Survey" />
        </li>
        <li><strong>Download Queue</strong><br> 
          <img src="https://raw.githubusercontent.com/Kait211/Practice/main/Download%20Queue.png" alt="Download Queue" />
        </li>
        <li><strong>Measure Distance</strong><br> 
          <img src="https://raw.githubusercontent.com/Kait211/Practice/main/Measure%20Distance.png" alt="Measure Distance" />
        </li>
        <li><strong>Settings</strong><br> 
          <img src="https://raw.githubusercontent.com/Kait211/Practice/main/Settings.png" alt="Settings" />
        </li>
        <li><strong>Reset Rotation</strong><br> 
          <img src="https://raw.githubusercontent.com/Kait211/Practice/main/Reset%20Rotation.png" alt="Reset Rotation" />
        </li>
        <li><strong>Zoom In</strong><br> 
          <img src="https://raw.githubusercontent.com/Kait211/Practice/main/Zoom%20In.png" alt="Zoom In" />
        </li>
        <li><strong>Zoom Out</strong><br> 
          <img src="https://raw.githubusercontent.com/Kait211/Practice/main/Zoom%20Out.png" alt="Zoom Out" />
        </li>
      </ul>
    </td>
  </tr>
  <tr>
    <td valign="top">Place waypoints and “Run Mission” with a bot.</td>
    <td valign="top">The Bot should “Run Mission” and show run through the waypoints.</td>
    <td valign="top">The bot went to the end waypoint, but I did not see the journey.</td>
    <td valign="top">No issues or errors.</td>
    <td valign="top">I would put an animation to see the journey the bot takes from beginning to end.
</td>
  </tr>
  <tr>
    <td valign="top">"Run Mission" with waypoints, then edit the waypoints to add new ones and "Run Mission" again.</td>
    <td valign="top">The bot should travel the edited waypoint route when I hit "Run Mission" on the bot.</td>
    <td valign="top">The bot navigated the initial waypoints successfully, but after editing the route and pressing "Run Mission," it remained at waypoint 4 instead of proceeding to waypoint 8.</td>
    <td valign="top">Possible issue here: the bot should travel to waypoint 8 after the route was edited and the mission was set to run.</td>
    <td valign="top">I wonder if users are supposed to do it another way to make the bot travel the edited route, or if once the mission starts, you can’t make the bot change positions later.
</td>
  </tr>
  <tr>
    <td valign="top">Run "System Check On All Bots".</td>
    <td valign="top">System check completes without errors.</td>
    <td valign="top">The sim displays the message, "Click the OK button to activate Bots: 1, 2, 3, 4." The system check was successful for all bots.</td>
    <td valign="top">No issues or errors.</td>
    <td valign="top">Missions cannot start unless the "System Check On All Bots" is completed.
</td>
  </tr>
  <tr>
    <td valign="top">Run system check with offline bots.</td>
    <td valign="top">Offline bots are flagged, and system check fails.</td>
    <td valign="top">When I clicked run systems, it says "Alert: The command cannot be sent to Bots: 1, 2, 3, 4 because the status age is greater than 30."</td>
    <td valign="top">No issues or errors.</td>
    <td valign="top">What does status age mean? Time bot has been unconnected to the hub possibly?
</td>
  </tr>
  <tr>
    <td valign="top">"Run Mission" without a system check.</td>
    <td valign="top">Mission should not start.</td>
    <td valign="top">Mission does not start and this message appears: "The command: START_MISSION cannot be sent because the bot is in the incorrect state. Available States: IN_MISSION_*, PRE_DEPLOYMENT_WAIT_FOR_MISSION_PLAN."</td>
    <td valign="top">No issues or Errors.</td>
    <td valign="top">Users must always do a "System Check On All Bots" for a mission to start.
</td>
  </tr>
  <tr>
    <td valign="top">See what happens if I kill all processes while the simulator is running.</td>
    <td valign="top">I expect the bots and waypoints to disappear.</td>
    <td valign="top">Connection dropped to Hub. </td>
    <td valign="top">No issues or Errors.</td>
    <td valign="top">Killing all processes seems to just drop the connection.
</td>
  </tr>
  <tr>
    <td valign="top">Add rally points on the map and then "Run Mission"</td>
    <td valign="top">I expect to see rally points, and when I press "Run Mission," the bots travel to rally points.</td>
    <td valign="top">I do see rally points, but when I ran the mission for bot 1, health went down and it said "Health is degraded. Warning: Mission infeasible—mission transit must have a goal."</td>
    <td valign="top">Bot health degraded, but this was most likely intended since there was no goal for transit.</td>
    <td valign="top">At this point, I am unsure what rally point does; must investigate it further.
</td>
  </tr>
  <tr>
    <td valign="top">Click on rally point and click the play button.</td>
    <td valign="top">I am unsure what this will do, but I assume at least one bot will travel to the rally point.</td>
    <td valign="top">All bots travel to the rally point.</td>
    <td valign="top">No issues or errors.</td>
    <td valign="top">It seems when I put waypoints for bots from the rally point, they don’t move; unsure why.
</td>
  </tr>
  <tr>
    <td valign="top">I placed two rally points, then go into "Edit Optimized Mission Survey." Then I click and drag on the sim map, then click apply in the "Optimize Mission Panel."</td>
    <td valign="top">I assume this will have an effect on the rally points.</td>
    <td valign="top">Waypoints are created from start rally to end rally. Then when I click on "Run Mission," all bots travel to the end rally.</td>
    <td valign="top">No issues or errors.</td>
    <td valign="top">Seems that I can only do this between two rally points because when I tried three, only the first two got connected.
</td>
  </tr>
  <tr>
    <td valign="top">Undoing last action</td>
    <td valign="top">I assume when I place a waypoint and then hit "Undo", the waypoint will disappear.</td>
    <td valign="top">The previous action is reverted, and the waypoint is effectively deleted.</td>
    <td valign="top">No issues or errors.</td>
     <td valign="top">"Undo" is a very useful tool that can be utilized when using the simulator.
</td>
  </tr>
  <tr>
    <td valign="top">"Undo" multiple times (up to 10).</td>
    <td valign="top">I expect all undos to work correctly and all previous actions to be undone.</td>
    <td valign="top">All previous actions are reverted, and all ten waypoints are deleted.</td>
    <td valign="top">No issues or errors.</td>
    <td valign="top">"Undo" can be used a maximum of ten times in a row.
</td>
  </tr>
  <tr>
    <td valign="top">Open "Mission Panel" and understand the icons inside it and their function.</td>
    <td valign="top">I expect to see icons and understand their functions.</td>
    <td valign="top">I see icons, and they are all clearly labeled, telling me what they are.</td>
    <td valign="top">No issues or errors.</td>
    <td valign="top">The icons in mission panel are<br>- Add Run<br>- Clear Mission<br>- Load Mission<br>- Save Mission<br>- Auto Assign Bots
</td>
  </tr>
  <tr>
    <td valign="top">In "Mission Panel," click "Add Run."</td>
    <td valign="top">I expect to be able to "Add Runs."</td>
    <td valign="top">I was able to duplicate runs for bot 2 after setting bot 1, but am unsure what repeats does because when I "Run Mission," it said Run 1 for bot 1 and Run 2 bot2. I thought repeats meant it would run the mission n times</td>
    <td valign="top">No issues or Errors.</td>
    <td valign="top">I must do more investigation to understand what Repeats does.
</td>
  </tr>
  <tr>
    <td valign="top">In "Mission Panel," click "Clear Mission."</td>
    <td valign="top">I expect all runs to be deleted and bots to return to the hub.</td>
    <td valign="top">The waypoints become transparent, and bots remain where they were last run.</td>
    <td valign="top">This is a possible issue: "Clear Mission" should probably reset bots, but it does not.</td>
    <td valign="top">I think the run is deleted, but am unsure why bots remain where they were after the last run that had been deleted.
</td>
  </tr>
  <tr>
    <td valign="top">In "Mission Panel," click "Save Mission."</td>
    <td valign="top">I expect the mission I created to save.</td>
    <td valign="top">The mission did save, and I saved it under the name "test."</td>
    <td valign="top">No issues or errors.</td>
    <td valign="top">I understand this function of the mission panel.
</td>
  </tr>
  <tr>
    <td valign="top">In "Mission Panel," click "Load Mission."</td>
    <td valign="top">I expect the mission to load and bots to run their created waypoint routes.</td>
    <td valign="top">The mission loaded, but the bots are not assigned to their waypoints anymore. When I activate the bots and click "Run Mission," I get this message: "Alert: Not sending to bots: 1, 2, 3, 4 because they are not assigned to runs." But upon further investigation, I now understand that you need to click "Auto Assign Bots" to have bots assigned to waypoints and be able to run.</td>
    <td valign="top">No issues or errors.</td>
    <td valign="top">All load missions must first complete a "System Check On All Bots," followed by "Auto Assign Bots" to navigate their waypoints.
</td>
  </tr>
  <tr>
    <td valign="top">"Mission Panel," click "Auto Assign Bots."</td>
    <td valign="top">Once the mission has loaded successfully, I expect the "Auto Assign Bots" function to assign bots to saved waypoint routes.</td>
    <td valign="top">The bots were assigned and ran the loaded waypoint routes.</td>
    <td valign="top">No issues or errors.</td>
    <td valign="top">With this test, I now understand the "Load Mission" function better.
</td>
  </tr>
  <tr>
    <td valign="top">Click on the "Download Queue" and test functions.</td>
    <td valign="top">I expect that when I download a CSV or KMZ file, it will be saved to my computer.</td>
    <td valign="top">When I click to download a CSV or KMZ file, the file is saved to my computer, but it appears blank except for the titles. I'm unsure how the data is being added.</td>
    <td valign="top">No issues of errors.</td>
    <td valign="top">I did a run with a bot using waypoints, then downloaded the CSV, but saw no data on it. I'm not sure what task causes data to be written, so I need to investigate this feature further.
</td>
  </tr>
  <tr>
    <td valign="top">Click on the "Measure Distance" icon.</td>
    <td valign="top">I expect to be able to measure a distance.</td>
    <td valign="top">I am able to measure distance.</td>
    <td valign="top">No issues or errors.</td>
    <td valign="top">This is a useful tool to measure the distance bots travel.
</td>
  </tr>
  <tr>
    <td valign="top">Test functions in the "Settings" icon.</td>
    <td valign="top">I expect that all the functions in Settings work and are easy to understand.</td>
    <td valign="top">
    <ul>
        <li><strong>Task Packets:</strong>
        <ul>
          <li>It has a clusters setting, but I am unsure what this does.</li>
          <li>Edit dates allows me to have a start date and end date, but I don’t know how this is supposed to be utilized.</li>
        </ul>
        <li><strong>Map Layers:</strong>
        <ul>
          <li>It allows me to change the map between ArcGIS Satellite and Open Street Map.</li>
          <li>Bathymetry allows me to check NOAA ENC Charts and GEBCO Bathymetry.</li>
          <li>Measurements allow me to check Dive Packets, Depth Contours, Drift Packets, and Drift Map.</li>
          <li>Mission allows me to check Missions, Active Missions, Rally Points, Mission Planning, Course Over Ground, Heading, Hub Comms Limit Circles, and Waypoint Capture Circles.</li>
          <li>Contacts, when opened, has nothing inside it.</li>
        </ul>
        <li><strong>Engineering:</strong>
        <ul>
          <li>Allows me to use features: JAIABOT ENGINEER AND DEBUG, QUERY SELECTED STATUS, QUERY ALL STATUSES, CHANGE GAINS, UPDATE SELECTED BOT, UPDATE ALL BOTS, QUERY BOT STATUS, SCAN FOR BOT, and SCAN FOR ALL BOTS.</li>
        </ul>
        <li><strong>Simulation:</strong>
        <ul>
          <li>Allows me to "Set Hub" location, where I can change the latitude and longitude of the hub location; I then have the options to SUBMIT VALUES and SELECT ON MAP.</li>
        </ul>
    </ul>
    </td>
    <td valign="top">Contacts have nothing inside it; this could be an issue.</td>
    <td valign="top">In addition to this, I must investigate these settings further. I tested their features and noticed that they change the simulation environment, but I’m unclear on how they are utilized when testing the bots through the simulator.
</td>
  </tr>
  <tr>
    <td valign="top">Click on the "Reset Rotation" icon.</td>
    <td valign="top">I expect that when I click "Reset Rotation," the map rotation will be reset.</td>
    <td valign="top">When I click the "Reset Rotation" icon, I see no noticeable change, but this could be because I did not change the map rotation. I am currently unsure how to change the map’s rotation.</td>
    <td valign="top">No issues or errors.</td>
    <td valign="top">I should investigate this icon further because I am unsure of its function and use.
</td>
  </tr>
  <tr>
    <td valign="top">Click on the "Zoom In" icon.</td>
    <td valign="top">I expect to zoom in on the sim.</td>
    <td valign="top">I do zoom in on the sim.</td>
    <td valign="top">No issues or errors.</td>
    <td valign="top">I can also use the scroll wheel on the mouse to zoom in.
</td>
  </tr>
  <tr>
    <td valign="top">Click on the "Zoom Out" icon.</td>
    <td valign="top">I expect to zoom out on the sim.</td>
    <td valign="top">I do zoom out on the sim.</td>
    <td valign="top">No issues or errors.</td>
    <td valign="top">I can also use the scroll wheel on the mouse to zoom out.
</td>
  </tr>
  <tr>
    <td valign="top">Click on the bot and check the settings inside.</td>
    <td valign="top">I expect to see all bot functions.</td>
    <td valign="top">I do see bot functions:
    <ul>
      <li>quick look</li>
      <li>commands</li>
      <li>advanced commands</li>
      <li>health</li>
      <li>Data</li>
      <li>GPS</li>
      <li>IMU</li>
      <li>Sensors</li>
    </ul>
    </td>
    <td valign="top">I don’t understand "RC Mode" because when I click on it and move the throttle or rudder, I don’t see the bot move.</td>
    <td valign="top">Must investigate "RC Mode" further to understand how to utilize it.
</td>
  </tr>
</table>

<br>
<a id="suggestions-for-improvement"></a>

# Suggestions for Improvement Table:
<br>
<table>
  <tr>
    <th>Area</th>
    <th>Current Issue</th>
    <th>Suggested Improvement</th>
    <th>Priority
    (Low/Medium/High)
    </th>
  </tr>
  <tr>
    <td valign="top">UI/UX</td>
    <td valign="top">There is no instruction in help that describes what "Reset Rotation" does.</td>
    <td valign="top">Add an instruction in "Help" to explain what "Reset Rotation" does.</td>
    <td valign="top">Low
</td>
  </tr>
  <tr>
    <td valign="top">UI/UX</td>
    <td valign="top">There is no instructional video on the simulator.</td>
    <td valign="top">Add a link to a video showing how to run different missions on the simulator. This would help those who are visual learners to use the sim.</td>
    <td valign="top">Medium
</td>
  </tr>
  <tr>
    <td valign="top">UI/UX</td>
    <td valign="top">There is no animation showing the bot’s journey from beginning to end when traveling waypoints.</td>
    <td valign="top">I would add an animation showing the journey the bot takes from beginning to end of waypoints.</td>
    <td valign="top">Medium
</td>
  </tr>
  <tr>
    <td valign="top">UI/UX</td>
    <td valign="top">There is no "Clear All" option to set the simulator back to the default settings.</td>
    <td valign="top">I would add a "Clear All" or "Reset To Default" option.</td>
    <td valign="top">High
</td>
  </tr>
  <tr>
    <td valign="top">Bots</td>
    <td valign="top">When bots are at the rally point, they don’t seem to move when waypoints are placed.</td>
    <td valign="top">Investigate this issue as it may be a bug that requires troubleshooting.</td>
    <td valign="top">High
</td>
  </tr>
  <tr>
    <td valign="top">Bots</td>
    <td valign="top">After completing a mission and running a waypoint route, if the route is edited, the bot does not change position when "Run Mission" is selected.</td>
    <td valign="top">Investigate and troubleshoot this potential bug.</td>
    <td valign="top">High
</td>
  </tr>
  <tr>
    <td valign="top">Bots</td>
    <td valign="top">"Clear Mission" in the "Mission Panel" should reset bots to the hub.</td>
    <td valign="top">Investigate and troubleshoot this potential bug.</td>
    <td valign="top">High
</td>
  </tr>
  <tr>
    <td valign="top">Map Layers</td>
    <td valign="top">In "Settings" under "Map Layers," the Contacts section is empty.</td>
    <td valign="top">Something should be displayed under "Contacts." This might require new code to execute.</td>
    <td valign="top">Low
</td>
  </tr>
  <tr>
    <td valign="top">Bot settings </td>
    <td valign="top">In bot settings under "Command," the function of "RC Mode" is unclear.</td>
    <td valign="top">There needs to be a clear explanation of what "RC Mode" does and how to use it.</td>
    <td valign="top">Medium
</td>
  </tr>
</table>