import React from 'react'
import './Sample.css'

interface Props {
    message: string
}

export default function Sample(props: Props) {
    return <div className="sample-container" role="greeting-message">{props.message}</div>
}
