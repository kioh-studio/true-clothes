## Feature

- Purpose : Help user upload and storage their item image and then used back when render in app

## Specs

- For free user, when they upload their item image, the image will be stored in local device and send the path to that item to database as string
- When user need to render back this item, the image path would be load from database to local device, then local device use this path to fnd the local image and resolve and resize

- For premium user, when they upload their image, the image go straigth to Supabase cloud
- When user need to render back the item, the image returned to user via request

