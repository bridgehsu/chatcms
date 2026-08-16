'use client';

import {ReactNode} from 'react';

interface Props {
    value: ReactNode,
    children?: ReactNode,
    className?: string
}

export default ({value, children, className}: Props) => {
    return (
        <div className={`page-title-bar ${className || ''}`}>
            <div className="page-title-copy">
                <h2 className="page-title-heading">{value}</h2>
            </div>
            <div className="page-title-actions">
                {children}
            </div>
        </div>
    );
}
