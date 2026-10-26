'use client'

export default function DeleteButton({
                                         message = 'Delete this post? Its votes and comments will be deleted too. This cannot be undone.',
                                     }: {
    message?: string
}) {
    return (
        <button
            type="submit"
            onClick={e => {
                if (!confirm(message)) {
                    e.preventDefault()
                }
            }}
            className="text-xs font-semibold text-red-700 underline"
        >
            Delete
        </button>
    )
}