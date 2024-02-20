export interface FileDescriptorSet {
    file?: FileDescriptorProto[]
}

export interface FileDescriptorProto {
    name?: string
    package?: string
    dependency?: string[]
    public_dependency?: number[]
    weak_dependency?: number[]
    message_type?: DescriptorProto[]
    enum_type?: EnumDescriptorProto[]
    service?: ServiceDescriptorProto[]
    extension?: FieldDescriptorProto[]
    options?: FileOptions
    source_code_info?: SourceCodeInfo
    syntax?: string
}

export interface ExtensionRange {
    start?: number
    end?: number
    options?: ExtensionRangeOptions
}

export interface ReservedRange {
    start?: number
    end?: number
}

export interface DescriptorProto {
    name?: string
    field?: FieldDescriptorProto[]
    extension?: FieldDescriptorProto[]
    nested_type?: DescriptorProto[]
    enum_type?: EnumDescriptorProto[]
    extension_range?: ExtensionRange[]
    oneof_decl?: OneofDescriptorProto[]
    options?: MessageOptions
    reserved_range?: ReservedRange[]
    reserved_name?: string[]
}

export interface ExtensionRangeOptions {
    uninterpreted_option?: UninterpretedOption[]
}

export enum Type {
    TYPE_DOUBLE = "TYPE_DOUBLE",
    TYPE_FLOAT = "TYPE_FLOAT",
    TYPE_INT64 = "TYPE_INT64",
    TYPE_UINT64 = "TYPE_UINT64",
    TYPE_INT32 = "TYPE_INT32",
    TYPE_FIXED64 = "TYPE_FIXED64",
    TYPE_FIXED32 = "TYPE_FIXED32",
    TYPE_BOOL = "TYPE_BOOL",
    TYPE_STRING = "TYPE_STRING",
    TYPE_GROUP = "TYPE_GROUP",
    TYPE_MESSAGE = "TYPE_MESSAGE",
    TYPE_BYTES = "TYPE_BYTES",
    TYPE_UINT32 = "TYPE_UINT32",
    TYPE_ENUM = "TYPE_ENUM",
    TYPE_SFIXED32 = "TYPE_SFIXED32",
    TYPE_SFIXED64 = "TYPE_SFIXED64",
    TYPE_SINT32 = "TYPE_SINT32",
    TYPE_SINT64 = "TYPE_SINT64",
}

export enum Label {
    LABEL_OPTIONAL = "LABEL_OPTIONAL",
    LABEL_REQUIRED = "LABEL_REQUIRED",
    LABEL_REPEATED = "LABEL_REPEATED",
}

export interface FieldDescriptorProto {
    name?: string
    number?: number
    label?: Label
    type?: Type
    type_name?: string
    extendee?: string
    default_value?: string
    oneof_index?: number
    json_name?: string
    options?: FieldOptions
}

export interface OneofDescriptorProto {
    name?: string
    options?: OneofOptions
}

export interface EnumReservedRange {
    start?: number
    end?: number
}

export interface EnumDescriptorProto {
    name?: string
    value?: EnumValueDescriptorProto[]
    options?: EnumOptions
    reserved_range?: EnumReservedRange[]
    reserved_name?: string[]
}

export interface EnumValueDescriptorProto {
    name?: string
    number?: number
    options?: EnumValueOptions
}

export interface ServiceDescriptorProto {
    name?: string
    method?: MethodDescriptorProto[]
    options?: ServiceOptions
}

export interface MethodDescriptorProto {
    name?: string
    input_type?: string
    output_type?: string
    options?: MethodOptions
    client_streaming?: boolean
    server_streaming?: boolean
}

export enum OptimizeMode {
    SPEED = "SPEED",
    CODE_SIZE = "CODE_SIZE",
    LITE_RUNTIME = "LITE_RUNTIME",
}

export interface FileOptions {
    java_package?: string
    java_outer_classname?: string
    java_multiple_files?: boolean
    java_generate_equals_and_hash?: boolean
    java_string_check_utf8?: boolean
    optimize_for?: OptimizeMode
    go_package?: string
    cc_generic_services?: boolean
    java_generic_services?: boolean
    py_generic_services?: boolean
    php_generic_services?: boolean
    deprecated?: boolean
    cc_enable_arenas?: boolean
    objc_class_prefix?: string
    csharp_namespace?: string
    swift_prefix?: string
    php_class_prefix?: string
    php_namespace?: string
    php_metadata_namespace?: string
    ruby_package?: string
    uninterpreted_option?: UninterpretedOption[]
}

export interface MessageOptions {
    msg?: GobyMessageOptions
}

export interface FieldOptions {
    field?: GobyFieldOptions
}

export interface OneofOptions {
    uninterpreted_option?: UninterpretedOption[]
}

export interface EnumOptions {
    allow_alias?: boolean
    deprecated?: boolean
    uninterpreted_option?: UninterpretedOption[]
}

export interface EnumValueOptions {
    deprecated?: boolean
    uninterpreted_option?: UninterpretedOption[]
}

export interface ServiceOptions {
    deprecated?: boolean
    uninterpreted_option?: UninterpretedOption[]
}

export enum IdempotencyLevel {
    IDEMPOTENCY_UNKNOWN = "IDEMPOTENCY_UNKNOWN",
    NO_SIDE_EFFECTS = "NO_SIDE_EFFECTS",
    IDEMPOTENT = "IDEMPOTENT",
}

export interface MethodOptions {
    deprecated?: boolean
    idempotency_level?: IdempotencyLevel
    uninterpreted_option?: UninterpretedOption[]
}

export interface NamePart {
    name_part?: string
    is_extension?: boolean
}

export interface UninterpretedOption {
    name?: NamePart[]
    identifier_value?: string
    positive_int_value?: number
    negative_int_value?: number
    double_value?: number
    string_value?: string
    aggregate_value?: string
}

export interface Location {
    path?: number[]
    span?: number[]
    leading_comments?: string
    trailing_comments?: string
    leading_detached_comments?: string[]
}

export interface SourceCodeInfo {
    location?: Location[]
}

export interface Annotation {
    path?: number[]
    source_file?: string
    begin?: number
    end?: number
}

export interface GeneratedCodeInfo {
    annotation?: Annotation[]
}

export enum ConfigAction {
    ALWAYS = "ALWAYS",
    NEVER = "NEVER",
    ADVANCED = "ADVANCED",
}

export interface ConfigurationOptions {
    cli_short?: string
    action?: ConfigAction
}

export interface GobyFieldOptions {
    description?: string
    example?: string
    moos_global?: string
    cfg?: ConfigurationOptions
}

export interface GobyMessageOptions {
    convertible_from?: string
}

export interface HealthRequest {
}

export enum HealthState {
    HEALTH__OK = "HEALTH__OK",
    HEALTH__DEGRADED = "HEALTH__DEGRADED",
    HEALTH__FAILED = "HEALTH__FAILED",
}

export enum Error {
    ERROR__PROCESS_DIED = "ERROR__PROCESS_DIED",
    ERROR__THREAD_NOT_RESPONDING = "ERROR__THREAD_NOT_RESPONDING",
    ERROR__VEHICLE__CRITICALLY_LOW_BATTERY = "ERROR__VEHICLE__CRITICALLY_LOW_BATTERY",
}

export interface ThreadHealth {
    name?: string
    thread_id?: number
    thread_id_apple?: number
    uid?: number
    state?: HealthState
    child?: ThreadHealth[]
    error?: Error
    error_message?: string
}

export interface ProcessHealth {
    name?: string
    pid?: number
    main?: ThreadHealth
}

export interface VehicleHealth {
    time?: number
    platform?: string
    state?: HealthState
    process?: ProcessHealth[]
}

export enum Warning {
    WARNING__TOO_MANY_WARNINGS_TO_REPORT_ALL = "WARNING__TOO_MANY_WARNINGS_TO_REPORT_ALL",
    WARNING__NOT_RESPONDING__UNKNOWN_APP = "WARNING__NOT_RESPONDING__UNKNOWN_APP",
    WARNING__NOT_RESPONDING__JAIABOT_ATLAS_SCIENTIFIC_EZO_EC_DRIVER = "WARNING__NOT_RESPONDING__JAIABOT_ATLAS_SCIENTIFIC_EZO_EC_DRIVER",
    WARNING__NOT_RESPONDING__JAIABOT_BLUEROBOTICS_PRESSURE_SENSOR_DRIVER = "WARNING__NOT_RESPONDING__JAIABOT_BLUEROBOTICS_PRESSURE_SENSOR_DRIVER",
    WARNING__NOT_RESPONDING__JAIABOT_ADAFRUIT_BNO055_DRIVER = "WARNING__NOT_RESPONDING__JAIABOT_ADAFRUIT_BNO055_DRIVER",
    WARNING__NOT_RESPONDING__JAIABOT_ADAFRUIT_BNO085_DRIVER = "WARNING__NOT_RESPONDING__JAIABOT_ADAFRUIT_BNO085_DRIVER",
    WARNING__MISSING_DATA__PITCH = "WARNING__MISSING_DATA__PITCH",
    WARNING__MISSING_DATA__ROLL = "WARNING__MISSING_DATA__ROLL",
    WARNING__MISSING_DATA__TEMPERATURE = "WARNING__MISSING_DATA__TEMPERATURE",
    WARNING__MISSING_DATA__COURSE = "WARNING__MISSING_DATA__COURSE",
    WARNING__NOT_CALIBRATED_SYS = "WARNING__NOT_CALIBRATED_SYS",
    WARNING__IMU_ISSUE = "WARNING__IMU_ISSUE",
    WARNING__TEMPERATURE__ARDUINO_TOO_HIGH = "WARNING__TEMPERATURE__ARDUINO_TOO_HIGH",
    WARNING__TEMPERATURE__LINUX_TOO_HIGH = "WARNING__TEMPERATURE__LINUX_TOO_HIGH",
    WARNING__COMMS_LOW_SIGNAL_STRENGTH = "WARNING__COMMS_LOW_SIGNAL_STRENGTH",
    WARNING__VEHICLE__LOW_BATTERY = "WARNING__VEHICLE__LOW_BATTERY",
    WARNING__SYSTEM__NTP_NOT_SYNCHRONIZED = "WARNING__SYSTEM__NTP_NOT_SYNCHRONIZED",
    WARNING__SYSTEM__NTP_OFFSET_HIGH = "WARNING__SYSTEM__NTP_OFFSET_HIGH",
    WARNING__SYSTEM__NTP_JITTER_HIGH = "WARNING__SYSTEM__NTP_JITTER_HIGH",
    WARNING__SYSTEM__RAM_SPACE_LOW = "WARNING__SYSTEM__RAM_SPACE_LOW",
    WARNING__SYSTEM__CPU_LOAD_FACTOR_HIGH = "WARNING__SYSTEM__CPU_LOAD_FACTOR_HIGH",
    WARNING__SYSTEM__ROOTFS_DISK_SPACE_LOW = "WARNING__SYSTEM__ROOTFS_DISK_SPACE_LOW",
    WARNING__SYSTEM__DATA_DISK_SPACE_LOW = "WARNING__SYSTEM__DATA_DISK_SPACE_LOW",
    WARNING__MISSION__INFEASIBLE_MISSION__TRANSIT_MUST_HAVE_A_GOAL = "WARNING__MISSION__INFEASIBLE_MISSION__TRANSIT_MUST_HAVE_A_GOAL",
    WARNING__MISSION__INFEASIBLE_MISSION__TRANSIT_CANNOT_RECOVER_AT_FINAL_GOAL_WITHOUT_A_GOAL = "WARNING__MISSION__INFEASIBLE_MISSION__TRANSIT_CANNOT_RECOVER_AT_FINAL_GOAL_WITHOUT_A_GOAL",
    WARNING__MISSION__INFEASIBLE_MISSION__MUST_HAVE_RECOVERY_LOCATION_IF_NOT_RECOVERING_AT_FINAL_GOAL = "WARNING__MISSION__INFEASIBLE_MISSION__MUST_HAVE_RECOVERY_LOCATION_IF_NOT_RECOVERING_AT_FINAL_GOAL",
    WARNING__MISSION__INFEASIBLE_MISSION__MINIMUM_BOTTOM_DEPTH_REACHED = "WARNING__MISSION__INFEASIBLE_MISSION__MINIMUM_BOTTOM_DEPTH_REACHED",
    WARNING__MISSION__INFEASIBLE_MISSION__GOAL_DESIRED_DEPTH_EXCEEDED_MAX = "WARNING__MISSION__INFEASIBLE_MISSION__GOAL_DESIRED_DEPTH_EXCEEDED_MAX",
    WARNING__MISSION__DATA_OFFLOAD_FAILED = "WARNING__MISSION__DATA_OFFLOAD_FAILED",
    WARNING__MISSION__DATA__GPS_FIX_DEGRADED = "WARNING__MISSION__DATA__GPS_FIX_DEGRADED",
}

export interface LoadAverages {
    one_min?: number
    five_min?: number
    fifteen_min?: number
}

export interface Processor {
    loads?: LoadAverages
    num_processes?: number
    num_processors?: number
}

export interface Information {
    total?: number
    available?: number
    use_percent?: number
}

export interface Memory {
    ram?: Information
    swap?: Information
}

export interface Disk {
    rootfs?: Information
    data?: Information
}

export interface WiFi {
    is_connected?: boolean
    link_quality?: number
    link_quality_percentage?: number
    signal_level?: number
    noise_level?: number
}

export interface LinuxHardwareStatus {
    uptime?: number
    processor?: Processor
    memory?: Memory
    disk?: Disk
    wifi?: WiFi
}

export enum SyncSource {
    SYNC_UNKNOWN = "SYNC_UNKNOWN",
    SYNC_UNSPECIFIED = "SYNC_UNSPECIFIED",
    SYNC_PPS = "SYNC_PPS",
    SYNC_LF_RADIO = "SYNC_LF_RADIO",
    SYNC_HF_RADIO = "SYNC_HF_RADIO",
    SYNC_UHF_RADIO = "SYNC_UHF_RADIO",
    SYNC_LOCAL = "SYNC_LOCAL",
    SYNC_NTP = "SYNC_NTP",
    SYNC_OTHER = "SYNC_OTHER",
    SYNC_WRISTWATCH = "SYNC_WRISTWATCH",
    SYNC_TELEPHONE = "SYNC_TELEPHONE",
}

export enum LeapIndicator {
    LEAP_UNKNOWN = "LEAP_UNKNOWN",
    LEAP_NONE = "LEAP_NONE",
    LEAP_LAST_MINUTE_HAS_61_SECONDS = "LEAP_LAST_MINUTE_HAS_61_SECONDS",
    LEAP_LAST_MINUTE_HAS_59_SECONDS = "LEAP_LAST_MINUTE_HAS_59_SECONDS",
    LEAP_CLOCK_NOT_SYNCHRONIZED = "LEAP_CLOCK_NOT_SYNCHRONIZED",
}

export enum NTPSystemEvent {
    NTP_SYSTEM_EVENT_UNKNOWN = "NTP_SYSTEM_EVENT_UNKNOWN",
    NTP_SYSTEM_EVENT_UNSPECIFIED = "NTP_SYSTEM_EVENT_UNSPECIFIED",
    NTP_SYSTEM_FREQ_NOT_SET = "NTP_SYSTEM_FREQ_NOT_SET",
    NTP_SYSTEM_FREQ_SET = "NTP_SYSTEM_FREQ_SET",
    NTP_SYSTEM_SPIKE_DETECT = "NTP_SYSTEM_SPIKE_DETECT",
    NTP_SYSTEM_FREQ_MODE = "NTP_SYSTEM_FREQ_MODE",
    NTP_SYSTEM_CLOCK_SYNC = "NTP_SYSTEM_CLOCK_SYNC",
    NTP_SYSTEM_RESTART = "NTP_SYSTEM_RESTART",
    NTP_SYSTEM_PANIC_STOP = "NTP_SYSTEM_PANIC_STOP",
    NTP_SYSTEM_NO_SYSTEM_PEER = "NTP_SYSTEM_NO_SYSTEM_PEER",
    NTP_SYSTEM_LEAP_ARMED = "NTP_SYSTEM_LEAP_ARMED",
    NTP_SYSTEM_LEAP_DISARMED = "NTP_SYSTEM_LEAP_DISARMED",
    NTP_SYSTEM_LEAP_EVENT = "NTP_SYSTEM_LEAP_EVENT",
    NTP_SYSTEM_CLOCK_STEP = "NTP_SYSTEM_CLOCK_STEP",
    NTP_SYSTEM_KERNEL_INFO = "NTP_SYSTEM_KERNEL_INFO",
    NTP_SYSTEM_LEAPSECOND_VALUES_UPDATE_FROM_FILE = "NTP_SYSTEM_LEAPSECOND_VALUES_UPDATE_FROM_FILE",
    NTP_SYSTEM_STALE_LEAPSECOND_VALUES = "NTP_SYSTEM_STALE_LEAPSECOND_VALUES",
}

export enum TallyCode {
    PEER_CODE_UNKNOWN = "PEER_CODE_UNKNOWN",
    PEER_NOT_VALID = "PEER_NOT_VALID",
    PEER_DISCARDED_BY_INTERSECTION = "PEER_DISCARDED_BY_INTERSECTION",
    PEER_DISCARDED_BY_TABLE_OVERFLOW = "PEER_DISCARDED_BY_TABLE_OVERFLOW",
    PEER_DISCARDED_BY_CLUSTER_ALGORITHM = "PEER_DISCARDED_BY_CLUSTER_ALGORITHM",
    PEER_INCLUDED_IN_COMBINE = "PEER_INCLUDED_IN_COMBINE",
    PEER_ALTERNATIVE_BACKUP = "PEER_ALTERNATIVE_BACKUP",
    PEER_SYSTEM_SYNC_SOURCE = "PEER_SYSTEM_SYNC_SOURCE",
    PEER_PPS_SYNC = "PEER_PPS_SYNC",
}

export interface NTPPeer {
    tally_code?: TallyCode
    remote?: string
    refid?: string
    stratum?: number
    when?: number
    poll?: number
    reach?: number
    delay?: number
    offset?: number
    jitter?: number
}

export interface NTPStatus {
    sync_source?: SyncSource
    leap_indicator?: LeapIndicator
    system_event_counter?: number
    last_system_event?: NTPSystemEvent
    system_sync_peer?: NTPPeer
    peer?: NTPPeer[]
}

export interface HelmIVPStatus {
    helm_ivp_state?: string
    helm_ivp_desired_speed?: boolean
    helm_ivp_desired_heading?: boolean
    helm_ivp_desired_depth?: boolean
    helm_ivp_data?: boolean
}

export interface SystemdStartReport {
    clear_error?: Error
}

export enum ServiceResult {
    SERVICE_RESULT_UNKNOWN = "SERVICE_RESULT_UNKNOWN",
    SERVICE_RESULT_SUCCESS = "SERVICE_RESULT_SUCCESS",
    SERVICE_RESULT_PROTOCOL = "SERVICE_RESULT_PROTOCOL",
    SERVICE_RESULT_TIMEOUT = "SERVICE_RESULT_TIMEOUT",
    SERVICE_RESULT_EXIT_CODE = "SERVICE_RESULT_EXIT_CODE",
    SERVICE_RESULT_SIGNAL = "SERVICE_RESULT_SIGNAL",
    SERVICE_RESULT_CORE_DUMP = "SERVICE_RESULT_CORE_DUMP",
    SERVICE_RESULT_WATCHDOG = "SERVICE_RESULT_WATCHDOG",
    SERVICE_RESULT_START_LIMIT_HIT = "SERVICE_RESULT_START_LIMIT_HIT",
    SERVICE_RESULT_RESOURCES = "SERVICE_RESULT_RESOURCES",
}

export interface SystemdStopReport {
    result?: ServiceResult
    error?: Error
    journal_dump_file?: string
}

export interface SystemdReportAck {
    error_ack?: Error
}

export interface GeographicCoordinate {
    lat?: number
    lon?: number
}

export interface LatLonPoint {
    lat?: number
    lon?: number
    depth?: number
    altitude?: number
}

export interface Waypoint {
    name?: string
    location?: LatLonPoint
}

export interface Route {
    name?: string
    point?: Waypoint[]
}

export interface Satellite {
    prn?: number
    az?: number
    el?: number
    ss?: number
    used?: boolean
    gnssid?: number
    svid?: number
    sigid?: number
    freqid?: number
    health?: number
}

export interface SkyView {
    device?: string
    time?: number
    gdop?: number
    hdop?: number
    pdop?: number
    tdop?: number
    vdop?: number
    xdop?: number
    ydop?: number
    nsat?: number
    usat?: number
    satellite?: Satellite[]
}

export interface Attitude {
    device?: string
    time?: number
    heading?: number
    pitch?: number
    yaw?: number
    roll?: number
}

export enum Mode {
    ModeNotSeen = "ModeNotSeen",
    ModeNoFix = "ModeNoFix",
    Mode2D = "Mode2D",
    Mode3D = "Mode3D",
}

export interface TimePositionVelocity {
    device?: string
    time?: number
    mode?: Mode
    location?: LatLonPoint
    altitude?: number
    track?: number
    speed?: number
    climb?: number
    epc?: number
    epd?: number
    eps?: number
    ept?: number
    epv?: number
    epx?: number
    epy?: number
}

export enum MissionState {
    PRE_DEPLOYMENT__STARTING_UP = "PRE_DEPLOYMENT__STARTING_UP",
    PRE_DEPLOYMENT__IDLE = "PRE_DEPLOYMENT__IDLE",
    PRE_DEPLOYMENT__SELF_TEST = "PRE_DEPLOYMENT__SELF_TEST",
    PRE_DEPLOYMENT__FAILED = "PRE_DEPLOYMENT__FAILED",
    PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN = "PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN",
    PRE_DEPLOYMENT__READY = "PRE_DEPLOYMENT__READY",
    IN_MISSION__UNDERWAY__REPLAN = "IN_MISSION__UNDERWAY__REPLAN",
    IN_MISSION__UNDERWAY__MOVEMENT__TRANSIT = "IN_MISSION__UNDERWAY__MOVEMENT__TRANSIT",
    IN_MISSION__UNDERWAY__MOVEMENT__REACQUIRE_GPS = "IN_MISSION__UNDERWAY__MOVEMENT__REACQUIRE_GPS",
    IN_MISSION__UNDERWAY__MOVEMENT__REMOTE_CONTROL__SETPOINT = "IN_MISSION__UNDERWAY__MOVEMENT__REMOTE_CONTROL__SETPOINT",
    IN_MISSION__UNDERWAY__MOVEMENT__REMOTE_CONTROL__STATION_KEEP = "IN_MISSION__UNDERWAY__MOVEMENT__REMOTE_CONTROL__STATION_KEEP",
    IN_MISSION__UNDERWAY__MOVEMENT__REMOTE_CONTROL__SURFACE_DRIFT = "IN_MISSION__UNDERWAY__MOVEMENT__REMOTE_CONTROL__SURFACE_DRIFT",
    IN_MISSION__UNDERWAY__MOVEMENT__REMOTE_CONTROL__REACQUIRE_GPS = "IN_MISSION__UNDERWAY__MOVEMENT__REMOTE_CONTROL__REACQUIRE_GPS",
    IN_MISSION__UNDERWAY__MOVEMENT__IMU_RESTART = "IN_MISSION__UNDERWAY__MOVEMENT__IMU_RESTART",
    IN_MISSION__UNDERWAY__TASK__STATION_KEEP = "IN_MISSION__UNDERWAY__TASK__STATION_KEEP",
    IN_MISSION__UNDERWAY__TASK__SURFACE_DRIFT = "IN_MISSION__UNDERWAY__TASK__SURFACE_DRIFT",
    IN_MISSION__UNDERWAY__TASK__REACQUIRE_GPS = "IN_MISSION__UNDERWAY__TASK__REACQUIRE_GPS",
    IN_MISSION__UNDERWAY__TASK__DIVE__DIVE_PREP = "IN_MISSION__UNDERWAY__TASK__DIVE__DIVE_PREP",
    IN_MISSION__UNDERWAY__TASK__DIVE__POWERED_DESCENT = "IN_MISSION__UNDERWAY__TASK__DIVE__POWERED_DESCENT",
    IN_MISSION__UNDERWAY__TASK__DIVE__HOLD = "IN_MISSION__UNDERWAY__TASK__DIVE__HOLD",
    IN_MISSION__UNDERWAY__TASK__DIVE__UNPOWERED_ASCENT = "IN_MISSION__UNDERWAY__TASK__DIVE__UNPOWERED_ASCENT",
    IN_MISSION__UNDERWAY__TASK__DIVE__POWERED_ASCENT = "IN_MISSION__UNDERWAY__TASK__DIVE__POWERED_ASCENT",
    IN_MISSION__UNDERWAY__TASK__DIVE__REACQUIRE_GPS = "IN_MISSION__UNDERWAY__TASK__DIVE__REACQUIRE_GPS",
    IN_MISSION__UNDERWAY__TASK__DIVE__SURFACE_DRIFT = "IN_MISSION__UNDERWAY__TASK__DIVE__SURFACE_DRIFT",
    IN_MISSION__UNDERWAY__TASK__DIVE__CONSTANT_HEADING = "IN_MISSION__UNDERWAY__TASK__DIVE__CONSTANT_HEADING",
    IN_MISSION__UNDERWAY__TASK__CONSTANT_HEADING = "IN_MISSION__UNDERWAY__TASK__CONSTANT_HEADING",
    IN_MISSION__UNDERWAY__TASK__IMU_RESTART = "IN_MISSION__UNDERWAY__TASK__IMU_RESTART",
    IN_MISSION__UNDERWAY__RECOVERY__TRANSIT = "IN_MISSION__UNDERWAY__RECOVERY__TRANSIT",
    IN_MISSION__UNDERWAY__RECOVERY__STATION_KEEP = "IN_MISSION__UNDERWAY__RECOVERY__STATION_KEEP",
    IN_MISSION__UNDERWAY__RECOVERY__STOPPED = "IN_MISSION__UNDERWAY__RECOVERY__STOPPED",
    IN_MISSION__UNDERWAY__RECOVERY__REACQUIRE_GPS = "IN_MISSION__UNDERWAY__RECOVERY__REACQUIRE_GPS",
    IN_MISSION__UNDERWAY__RECOVERY__IMU_RESTART = "IN_MISSION__UNDERWAY__RECOVERY__IMU_RESTART",
    IN_MISSION__UNDERWAY__ABORT = "IN_MISSION__UNDERWAY__ABORT",
    POST_DEPLOYMENT__RECOVERED = "POST_DEPLOYMENT__RECOVERED",
    POST_DEPLOYMENT__DATA_PROCESSING = "POST_DEPLOYMENT__DATA_PROCESSING",
    POST_DEPLOYMENT__DATA_OFFLOAD = "POST_DEPLOYMENT__DATA_OFFLOAD",
    POST_DEPLOYMENT__IDLE = "POST_DEPLOYMENT__IDLE",
    POST_DEPLOYMENT__SHUTTING_DOWN = "POST_DEPLOYMENT__SHUTTING_DOWN",
}

export interface Speeds {
    transit?: number
    stationkeep_outer?: number
}

export interface MissionReport {
    state?: MissionState
    active_goal?: number
    active_goal_location?: GeographicCoordinate
    distance_to_active_goal?: number
    active_goal_timeout?: number
    data_offload_percentage?: number
    repeat_index?: number
}

export enum TaskType {
    NONE = "NONE",
    DIVE = "DIVE",
    STATION_KEEP = "STATION_KEEP",
    SURFACE_DRIFT = "SURFACE_DRIFT",
    CONSTANT_HEADING = "CONSTANT_HEADING",
    LISTEN = "LISTEN"
}

export interface DiveParameters {
    max_depth?: number
    depth_interval?: number
    hold_time?: number
}

export interface DriftParameters {
    drift_time?: number
}

export interface ConstantHeadingParameters {
    constant_heading?: number
    constant_heading_time?: number
    constant_heading_speed?: number
}

export interface ListenParameters {
    listen_depth: number
}

export interface MissionTask {
    type?: TaskType
    dive?: DiveParameters
    surface_drift?: DriftParameters
    constant_heading?: ConstantHeadingParameters
    listen?: ListenParameters
}

export enum MissionStart {
    START_IMMEDIATELY = "START_IMMEDIATELY",
    START_ON_COMMAND = "START_ON_COMMAND",
}

export enum MovementType {
    TRANSIT = "TRANSIT",
    REMOTE_CONTROL = "REMOTE_CONTROL",
}

export interface Goal {
    name?: string
    location?: GeographicCoordinate
    task?: MissionTask
    moveWptMode?: boolean
}

export interface Recovery {
    recover_at_final_goal?: boolean
    location?: GeographicCoordinate
}

export interface MissionPlan {
    start?: MissionStart
    movement?: MovementType
    goal?: Goal[]
    recovery?: Recovery
    speeds?: Speeds
    bottomDepthSafetyParams?: BottomDepthSafetyParams
    fragment_index?: number
    expected_fragments?: number
    repeats?: number
}

export interface TransitUpdate {
    active?: boolean
    x?: number
    y?: number
    speed?: number
    slip_radius?: number
}

export interface StationkeepUpdate {
    active?: boolean
    x?: number
    y?: number
    outer_speed?: number
    transit_speed?: number
    center_activate?: boolean
}

export interface ConstantHeadingUpdate {
    active?: boolean
    heading?: number
}

export interface ConstantSpeedUpdate {
    active?: boolean
    speed?: number
}

export interface IvPBehaviorUpdate {
    transit?: TransitUpdate
    stationkeep?: StationkeepUpdate
    constantHeading?: ConstantHeadingUpdate
    constantSpeed?: ConstantSpeedUpdate
}

export interface TransitReport {
    waypoint_reached?: boolean
}

export interface IvPBehaviorReport {
    transit?: TransitReport
}

export interface MissionTpvMeetsGpsReq {
    tpv?: TimePositionVelocity
}

export interface NodeStatus {
    time?: number
    name?: string
    type?: VehicleType
    global_fix?: LatLonPoint
    local_fix?: CartesianCoordinate
    pose?: EulerAngles
    speed?: Speed
    source?: Source
}

export interface DesiredCourse {
    time?: number
    heading?: number
    speed?: number
    depth?: number
    pitch?: number
    roll?: number
    z_rate?: number
    altitude?: number
}

export enum VehicleType {
    UNKNOWN = "UNKNOWN",
    AUV = "AUV",
    GLIDER = "GLIDER",
    USV = "USV",
    USV_POWERED = "USV_POWERED",
    USV_SAILING = "USV_SAILING",
    ROV = "ROV",
    TARGET = "TARGET",
    BUOY = "BUOY",
    MOORING = "MOORING",
    MOORING_SUBSURFACE = "MOORING_SUBSURFACE",
    MOORING_SURFACE = "MOORING_SURFACE",
    SHIP = "SHIP",
    OTHER = "OTHER",
}

export enum Sensor {
    GPS = "GPS",
    USBL = "USBL",
    LBL = "LBL",
    INERTIAL_NAVIGATION_SYSTEM = "INERTIAL_NAVIGATION_SYSTEM",
    PRESSURE = "PRESSURE",
    DVL = "DVL",
    RPM_LOOKUP = "RPM_LOOKUP",
    MAGNETIC_COMPASS = "MAGNETIC_COMPASS",
}

export interface Source {
    position?: Sensor
    depth?: Sensor
    speed?: Sensor
    heading?: Sensor
}

export interface CartesianCoordinate {
    x?: number
    y?: number
    z?: number
}

export interface EulerAngles {
    roll?: number
    pitch?: number
    heading?: number
    course_over_ground?: number
    roll_rate?: number
    pitch_rate?: number
    heading_rate?: number
}

export interface Speed {
    over_ground?: number
    over_water?: number
}

export enum SalinityAlgorithm {
    SAL_ALGORITHM_UNKNOWN = "SAL_ALGORITHM_UNKNOWN",
    UNESCO_44_PREKIN_AND_LEWIS_1980 = "UNESCO_44_PREKIN_AND_LEWIS_1980",
}

export enum SoundSpeedAlgorithm {
    SS_ALGORITHM_UNKNOWN = "SS_ALGORITHM_UNKNOWN",
    UNESCO_44_CHEN_AND_MILLERO_1977 = "UNESCO_44_CHEN_AND_MILLERO_1977",
    MACKENZIE_1981 = "MACKENZIE_1981",
    DEL_GROSSO_1974 = "DEL_GROSSO_1974",
}

export enum DensityAlgorithm {
    DENSITY_ALGORITHM_UNKNOWN = "DENSITY_ALGORITHM_UNKNOWN",
    UNESCO_38_MILLERO_AND_POISSON_1981 = "UNESCO_38_MILLERO_AND_POISSON_1981",
}

export interface CTDSample {
    time?: number
    conductivity?: number
    temperature?: number
    pressure?: number
    salinity?: number
    sound_speed?: number
    density?: number
    global_fix?: LatLonPoint
    salinity_algorithm?: SalinityAlgorithm
    sound_speed_algorithm?: SoundSpeedAlgorithm
    density_algorithm?: DensityAlgorithm
}

export interface DatumUpdate {
    datum?: LatLonPoint
}

export enum SetpointType {
    SETPOINT_STOP = "SETPOINT_STOP",
    SETPOINT_IVP_HELM = "SETPOINT_IVP_HELM",
    SETPOINT_REMOTE_CONTROL = "SETPOINT_REMOTE_CONTROL",
    SETPOINT_DIVE = "SETPOINT_DIVE",
    SETPOINT_POWERED_ASCENT = "SETPOINT_POWERED_ASCENT",
}

export interface RemoteControl {
    duration?: number
    heading?: number
    speed?: number
}

export interface DesiredSetpoints {
    type?: SetpointType
    helm_course?: DesiredCourse
    remote_control?: RemoteControl
    dive_depth?: number
    throttle?: number
    is_helm_constant_course?: boolean
}

export enum IMUCommandType {
    TAKE_READING = "TAKE_READING",
    START_WAVE_HEIGHT_SAMPLING = "START_WAVE_HEIGHT_SAMPLING",
    STOP_WAVE_HEIGHT_SAMPLING = "STOP_WAVE_HEIGHT_SAMPLING",
    START_BOTTOM_TYPE_SAMPLING = "START_BOTTOM_TYPE_SAMPLING",
    STOP_BOTTOM_TYPE_SAMPLING = "STOP_BOTTOM_TYPE_SAMPLING",
}

export interface IMUCommand {
    type?: IMUCommandType
}

export interface EulerAngles {
    heading?: number
    pitch?: number
    roll?: number
}

export interface Acceleration {
    x?: number
    y?: number
    z?: number
}

export interface IMUData {
    euler_angles?: EulerAngles
    linear_acceleration?: Acceleration
    gravity?: Acceleration
    calibration_status?: number
    bot_rolled_over?: boolean
    significant_wave_height?: number
    max_acceleration?: number
}

export enum SolutionType {
    STOP_BOT = "STOP_BOT",
    USE_COG = "USE_COG",
    USE_CORRECTION = "USE_CORRECTION",
    RESTART_BOT = "RESTART_BOT",
    REBOOT_BOT = "REBOOT_BOT",
    REPORT_IMU = "REPORT_IMU",
    RESTART_IMU_PY = "RESTART_IMU_PY",
    REBOOT_BNO085_IMU = "REBOOT_BNO085_IMU",
    REBOOT_BNO085_IMU_AND_RESTART_IMU_PY = "REBOOT_BNO085_IMU_AND_RESTART_IMU_PY",
}

export interface IMUIssue {
    solution?: SolutionType
}

export enum CommandType {
    MISSION_PLAN = "MISSION_PLAN",
    ACTIVATE = "ACTIVATE",
    START_MISSION = "START_MISSION",
    MISSION_PLAN_FRAGMENT = "MISSION_PLAN_FRAGMENT",
    NEXT_TASK = "NEXT_TASK",
    RETURN_TO_HOME = "RETURN_TO_HOME",
    STOP = "STOP",
    REMOTE_CONTROL_SETPOINT = "REMOTE_CONTROL_SETPOINT",
    REMOTE_CONTROL_TASK = "REMOTE_CONTROL_TASK",
    REMOTE_CONTROL_RESUME_MOVEMENT = "REMOTE_CONTROL_RESUME_MOVEMENT",
    RECOVERED = "RECOVERED",
    SHUTDOWN = "SHUTDOWN",
    RETRY_DATA_OFFLOAD = "RETRY_DATA_OFFLOAD",
    RESTART_ALL_SERVICES = "RESTART_ALL_SERVICES",
    REBOOT_COMPUTER = "REBOOT_COMPUTER",
    SHUTDOWN_COMPUTER = "SHUTDOWN_COMPUTER",
}

export interface Command {
    bot_id?: number
    time?: number
    type?: CommandType
    plan?: MissionPlan
    rc?: RemoteControl
    rc_task?: MissionTask
}

export enum HubCommandType {
    SCAN_FOR_BOTS = "SCAN_FOR_BOTS",
    RESTART_ALL_SERVICES = "RESTART_ALL_SERVICES",
    REBOOT_COMPUTER = "REBOOT_COMPUTER",
    SHUTDOWN_COMPUTER = "SHUTDOWN_COMPUTER",
}

export interface CommandForHub {
    hub_id?: number
    time?: number
    type?: HubCommandType
    scan_for_bot_id?: number
}

export interface Attitude {
    roll?: number
    pitch?: number
    heading?: number
    course_over_ground?: number
}

export interface Speed {
    over_ground?: number
    over_water?: number
}

export interface BotStatus {
    bot_id?: number
    time?: number
    last_command_time?: number
    health_state?: HealthState
    error?: Error[]
    warning?: Warning[]
    location?: GeographicCoordinate
    depth?: number
    attitude?: Attitude
    speed?: Speed
    mission_state?: MissionState
    active_goal?: number
    distance_to_active_goal?: number
    active_goal_timeout?: number
    repeat_index?: number
    salinity?: number
    temperature?: number
    thermocouple_temperature?: number
    vv_current?: number
    vcc_current?: number
    vcc_voltage?: number
    battery_percent?: number
    calibration_status?: number
    hdop?: number
    pdop?: number
    data_offload_percentage?: number
    wifi_link_quality_percentage?: number
}

export interface EstimatedDrift {
    speed?: number
    heading?: number
}

export interface DriftPacket {
    drift_duration?: number
    estimated_drift?: EstimatedDrift
    start_location?: GeographicCoordinate
    end_location?: GeographicCoordinate
    significant_wave_height?: number
}

export interface Measurements {
    mean_depth?: number
    mean_temperature?: number
    mean_salinity?: number
}

export enum BottomType {
    HARD = "HARD",
    SOFT = "SOFT",
}

export interface DivePacket {
    dive_rate?: number
    unpowered_rise_rate?: number
    powered_rise_rate?: number
    depth_achieved?: number
    measurement?: Measurements[]
    start_location?: GeographicCoordinate
    duration_to_acquire_gps?: number
    bottom_dive?: boolean
    reached_min_depth?: boolean
    bottom_type?: BottomType
    max_acceleration?: number
}

export interface TaskPacket {
    bot_id?: number
    start_time?: number
    end_time?: number
    type?: TaskType
    dive?: DivePacket
    drift?: DriftPacket
}

export interface SurfaceBounds {
    upper?: number
    lower?: number
    center?: number
}

export interface MotorBounds {
    forwardStart?: number
    reverseStart?: number
    max_reverse?: number
    throttle_zero_net_buoyancy?: number
    throttle_dive?: number
    throttle_ascent?: number
}

export interface Bounds {
    strb?: SurfaceBounds
    port?: SurfaceBounds
    rudder?: SurfaceBounds
    motor?: MotorBounds
}

export interface PIDSettings {
    target?: number
    Kp?: number
    Ki?: number
    Kd?: number
}

export interface PIDControl {
    timeout?: number
    throttle?: number
    speed?: PIDSettings
    rudder?: number
    heading?: PIDSettings
    port_elevator?: number
    stbd_elevator?: number
    roll?: PIDSettings
    pitch?: PIDSettings
    depth?: PIDSettings
    led_switch_on?: boolean
    heading_constant?: PIDSettings
}

export enum BotStatusRate {
    BotStatusRate_2_Hz = "BotStatusRate_2_Hz",
    BotStatusRate_1_Hz = "BotStatusRate_1_Hz",
    BotStatusRate_2_SECONDS = "BotStatusRate_2_SECONDS",
    BotStatusRate_5_SECONDS = "BotStatusRate_5_SECONDS",
    BotStatusRate_10_SECONDS = "BotStatusRate_10_SECONDS",
    BotStatusRate_20_SECONDS = "BotStatusRate_20_SECONDS",
    BotStatusRate_40_SECONDS = "BotStatusRate_40_SECONDS",
    BotStatusRate_60_SECONDS = "BotStatusRate_60_SECONDS",
    BotStatusRate_NO_RF = "BotStatusRate_NO_RF",
}

export interface GPSRequirements {
    transit_hdop_req?: number
    transit_pdop_req?: number
    after_dive_hdop_req?: number
    after_dive_pdop_req?: number
    transit_gps_fix_checks?: number
    transit_gps_degraded_fix_checks?: number
    after_dive_gps_fix_checks?: number
}

export interface RFDisableOptions {
    rf_disable?: boolean
    rf_disable_timeout_mins?: number
}

export interface BottomDepthSafetyParams {
    constant_heading: number
    constant_heading_time: number
    constant_heading_speed: number
    safety_depth: number
}

export interface Engineering {
    bot_id?: number
    time?: number
    pid_control?: PIDControl
    query_engineering_status?: boolean
    query_bot_status?: boolean
    engineering_messages_enabled?: boolean
    bot_status_rate?: BotStatusRate
    gps_requirements?: GPSRequirements
    rf_disable_options?: RFDisableOptions
    bottom_depth_safety_params?: BottomDepthSafetyParams
    flag?: number
    bounds?: Bounds
}

export interface HubStatus {
    hub_id?: number
    fleet_id?: number
    time?: number
    health_state?: HealthState
    error?: Error[]
    warning?: Warning[]
    location?: GeographicCoordinate
    bot_ids_in_radio_file?: number[]
    linux_hardware_status?: LinuxHardwareStatus
}

