TMPDIR=$(mktemp -d)

function handle_failure() {
    echo "FAILURE"
    exit 1
}
trap handle_failure ERR

# Runs an AWS command, optionally displays the output if DEBUG=true, and returns a jq filter if set
function run() {
    # $1: jq filter
    # ${@:2}: AWS CLI command
    
    # Execute the AWS CLI command and capture the output
    local aws_command_output
    echo "" >&2
    aws_command_output=$(set -x; "${@:2}" --output json)
    result=$?

    if [[ "$DEBUG" = "true" ]]; then
        # Display the full output in compact form
        echo "$aws_command_output" | jq -c . >&2
    fi

    if [ ! -z "$1" ]; then
       # Apply the jq filter and return the result
       local filtered_output
       filtered_output=$(echo "$aws_command_output" | jq -r "$1")
       echo "$filtered_output"
    fi

    if [[ "$result" = "0" ]]; then
        echo "OK" >&2
    fi
    echo "" >&2
    
    return $result
}
