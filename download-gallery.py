#!/usr/bin/env python3
"""
Downloads all gallery images from Squarespace CDN into local folders.
Run once: python3 download-gallery.py
After running, update script.js to use local paths.
"""

import urllib.request
import ssl
import os
import time

ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

BASE = 'https://images.squarespace-cdn.com/content/v1/676dbe11e77f9863643f12c3/'

images = {
    'environmental': [
        'b30f46ab-6ed8-4dca-8c16-d5f77e963db9/DSCF2774.jpg',
        '3d50e56d-d5fb-445b-9e1c-5facbe679fa5/IMG_3728.jpg',
        '58d57176-fb87-40c1-a163-b184c34b8b5e/DSCF3204.jpg',
        '45c7ad6e-083f-4a98-9792-8864a182e85c/IMG_3759.jpg',
        '9bd3b67e-92a7-469b-a3b4-0393d7797423/DSCF3159.jpg',
        '1fd72930-db28-4d2f-9a99-79d1d236ae64/DSCF3302.jpg',
        'a25dbfbe-9292-4ae0-b285-004f14b7f6f2/IMG_3782.jpg',
        '9481e5d7-bc62-47fe-949e-49e277722cf2/DSCF3194.jpg',
        '803c73f9-5d72-458f-9eba-3d832c6f6d48/DSCF2778.jpg',
        '08c4d240-00f4-4eea-93d3-00aacec268a6/DSCF2787.jpg',
        '10c2c22a-3ee1-4d3c-932c-ec78caed035d/DSCF2939-2.jpg',
        'a2d164fa-3121-4c36-8760-20c3f1d311b6/IMG_3772.jpg',
        '118ce552-535c-4b14-8afc-255fc3e95eff/IMG_3795.jpg',
        '918640cd-2f71-405f-9227-76e3aea1267f/DSCF3427.jpg',
        '7a0f6a68-aee8-4331-a8cd-fb849135569c/DSCF3255.jpg',
        'cecab54e-5a0a-42ff-97e0-b6bcf66e4e73/DSCF3001.jpg',
        '7bea9a01-3454-4207-a18a-f10d16815d5e/DSCF2795.jpg',
        '4438e9a5-84e4-4dc5-80b7-b9853a67495e/DSCF3474.jpg',
        '095d289a-867e-41cb-99c3-8ca97b03aa26/DSCF3220.jpg',
        '04023576-2d40-43cd-a39f-81d49acc701a/IMG_3862.jpg',
        '2a85d8c7-5a25-48c9-b5eb-53e46b251458/DSCF3223.jpg',
        'a881c1cd-5cc8-45b1-ab1e-53b5477221e0/DSCF2940.jpg',
        'b42d79a0-1b23-42ad-8ed7-0976c048e2a0/DSCF2839.jpg',
        'b12a1c2c-4cd5-4bf3-9f06-9ac6a36d88ad/DSCF3213.jpg',
        '77acced6-4e8a-41b3-8e1c-f68445037077/IMG_3910.jpg',
        'ff08981f-1678-4c66-9998-6dee2c7160c3/IMG_5675.jpg',
        '587b37f6-edf4-419c-b8eb-9497d6db42d5/DSCF3022.jpg',
        'c8645faa-473c-4ef6-a5a8-f5f293dd06c2/DSCF3197.jpg',
        'db036226-6be5-4249-9efa-b7bb2f9d9699/DSCF2937.jpg',
        '0a8dc77b-e309-423a-990d-37f59929e4bb/DSCF2997.jpg',
        '48e114b3-c5e5-4a23-a262-02e28a27ac48/IMG_2028.jpg',
        '58cb1eca-aa34-40f7-a54d-2c0eac29d3f9/DSCF3005.jpg',
        'b3b26701-1c7e-4967-99eb-36693d06f731/DSCF3236.jpg',
        '1e97ecf4-b654-4ea8-b322-081d3aeb7992/DSCF2280.JPG',
        'f6a4f9bb-f926-4f1b-8660-33ec34cb4ed8/DSCF2705.JPG',
        'd204054b-f738-43ff-b94b-4f7dbf640516/IMG_1154.JPG',
        '575417ed-cd14-4953-865b-f192ff0b4261/DSCF3838.jpg',
        'd874308d-af55-4f21-a20e-edcc1ebf6f42/DSCF3848.jpg',
        '547afa33-8d4a-445b-a456-4bddbbadd70e/DSCF3870.jpg',
        'b74290c3-3c6c-4973-8e14-bf1c5107b5a2/DSCF3891.jpg',
        '23f7f062-eee3-431f-9a4e-982bf1b9c6f9/DSCF3912.jpg',
        '0e99873d-fa34-4ce5-b407-cff333388a56/DSCF3923.jpg',
        '5e5fcc6b-0b0f-4dee-b98e-a79bf486604f/DSCF3937.jpg',
        '35842117-8911-425f-8c8e-e3209d05988b/DSCF3953.jpg',
        'bf7a2ca3-8976-4ac3-a3fb-e8173dcc909d/DSCF3958-Enhanced-NR.jpg',
        '7899f567-a6a4-4419-bbdc-5f1b78b9a894/DSCF3974.jpg',
        'bb365422-4b68-4d24-af9f-5807241a3d3f/DSCF3978.jpg',
        '33a33c3c-13e2-426f-8dd4-3a2b999bd3f4/DSCF4036.jpg',
        'a51beb0b-4367-4115-9959-e869f6a56e39/IMG_0020.JPG',
        'e231e5b8-1e82-4027-bf7c-e0bb4c3d6020/IMG_0050.jpg',
        '17546b0e-174f-434a-af2f-ec36908a0332/IMG_0085.jpg',
        'b18209f2-a56b-4202-a9d2-13f8dd19bc5f/IMG_0838.JPG',
        '319855a6-c052-4da5-bd71-6a8f18452fa5/IMG_0900.JPG',
        '26f8159a-cec5-4162-a9a3-9653d6431437/IMG_0931.JPG',
        '3eddd19a-8a78-4e9f-bb75-8b900e633566/IMG_0960.JPG',
        '49d5b070-9f73-452e-a420-61c156448fa1/IMG_0986.JPG',
        '63b45117-e51e-42e5-b26e-f452ecbe9ad0/IMG_1217.JPG',
        '15d7f58c-4bed-4f77-8459-51eaf32312c0/IMG_1249.JPG',
        '3f421b13-ffee-4845-8867-29547d36cdd1/IMG_1941.jpg',
        'aac42770-2f69-474d-b450-0d0261e2ef31/IMG_2125.jpg',
        '8a90af18-c1cc-4969-949b-ef0a5f3e5f61/IMG_2159.jpg',
        '9c6bfbba-9ba7-4983-91f7-2a4b3f1be81a/IMG_2425-2.jpg',
        '330ea1bd-3e86-48d0-8a3d-301069c7c50a/IMG_5106.jpg',
        '1d0f3e02-879c-4a42-a30a-607562a22f7c/IMG_6413-2.jpg',
        '7d90b24c-bc0d-4f54-9291-b9943fedf000/IMG_6501.jpg',
        '589155a5-b25d-410b-b083-4eb42188965c/IMG_6523.JPG',
        '27b7759d-fc42-4c96-ac1b-28f1eeeeef06/IMG_6586-2.jpg',
        '0396f80f-1b2b-4808-8a0b-1cb60a1709c9/IMG_6586.JPG',
        '3300887b-6d3f-40ea-8d17-41c0335d46f5/IMG_8909.jpg',
        'ad52e3ac-165a-42dd-81bb-2f5d84fa8a67/IMG_9184.jpg',
        'ff788ed8-b70d-45e5-becd-13eb793cef27/IMG_9938.JPG',
        'da482891-589c-4647-8a54-0f8e6cb6ce95/IMG_9987.JPG',
        '319ac2cc-2517-4815-b7b6-e2ab2278561d/ZIONTRIPe-4.jpg',
        '0bfad477-1de0-40a1-b88f-86e650e035cb/ZIONTRIPe-10.jpg',
        '05a9f615-b79d-4f26-b826-d05ea6c9eb1a/ZIONTRIPe-27.jpg',
        '18daf9c8-6997-41d0-8791-a2826b591155/DSCF4823.jpg',
        'eb6bc3f9-3431-4b6d-bb30-509d60c0af32/DSCF4836.jpg',
        '8aa6f39f-e0b0-4e19-bbb5-b6edc8183787/DSCF4830-Enhanced-NR.jpg',
        '5628a5ae-6b8e-4b12-be09-deecbf9d597a/DSCF3478.jpg',
        'd43ea231-6f7c-488a-aa07-515716848ed9/DSCF3480.jpg',
        'ba2c057b-a394-4fd7-bc41-8846386a77c8/DSCF3224.jpg',
        '14a5fb0f-f1ba-4bc0-b509-61c75c801b89/DSCF3227.jpg',
        '90124287-eba7-4201-b1a0-4adf779f7706/DSCF3244.jpg',
        '9566b129-88b6-4e3c-9b39-6941432f9f9c/DSCF3282.jpg',
        '673994dd-28bc-46af-be05-7600f5493968/DSCF3358.jpg',
        '66477b78-dd28-41be-972e-61f29b9b5aad/DSCF3371.jpg',
    ],
    'sports': [
        '7334bc8d-02b0-442c-96a2-1d0b3704764b/DSCF1733.jpg',
        'd0d61185-a83d-456c-8069-92d5b76add71/DSCF1625.jpg',
        '20c377d5-b157-41d9-8773-f2cc8f10b597/DSCF1630.jpg',
        'cef681b2-009e-4910-ae35-f138d3eb66e9/DSCF0206.jpg',
        '20508a92-2569-4466-9583-1ac09d507dbf/DSCF5619.jpg',
        'b3c8c3a6-da32-4bcc-9aeb-64dc6317e355/DSCF1720.jpg',
        'a8de36f6-824e-4a0d-81d3-1a09ad75333c/DSCF0231.jpg',
        '641859f7-5413-47c2-bf6d-8146c6fe7ebc/DSCF0270.jpg',
        '9776d466-1b98-4d43-9c2b-019c5ec650c4/DSCF1864_1.JPG',
        'e96e1fd3-519c-4279-83fc-6faf4ae80df1/DSCF5078.jpg',
        '8453d607-74e9-4fd5-ac9d-c9b3f207e4c7/DSCF1703.jpg',
        'f7abe74b-8308-442f-84b5-7c44a9d296cc/DSCF6049.JPG',
        '1696b0aa-6292-4445-a469-dabf0afd5f89/DSCF0279.jpg',
        '97a4ae05-de26-4f09-bc2d-04e24b0bfa0b/DSCF1535.jpg',
        '6c6e8243-fa24-4e12-b26b-678f5bcb3911/DSC04311.JPG',
        'd4f7adf8-6a8f-4260-8943-39a039ff856e/DSC04296.JPG',
        '8b9d1712-8cb5-4acb-a4b6-3e47ee3f0c69/A4EFB72F-20D6-414F-A213-7DB1DAD8948C-7306-000000DB5C30DE54.jpg',
        '923d926c-cb63-4d02-b777-419ddf3587f3/DSCF5116.jpg',
        '8e680684-a128-4d78-a632-042aec968cb9/DSCF5090.jpg',
        '3704f42a-eb37-41e5-bc48-b2b4460db49b/tempImage6U6aU1.remini-enhanced.jpg',
        'a5928c17-3f4f-44e1-b3df-5b64420986f5/DSCF7193.jpg',
        '432efa6a-3ad4-4880-a8d3-7fd77196072b/DSCF7207.jpg',
        'b7b5b2fc-99cf-4b03-8d28-d652c65f4512/IMG_0226.jpg',
        '162225ef-7c54-437f-b585-5d29f12823a2/DSCF4540.JPEG',
        '165a7bdc-cc5a-471d-ab67-eefe37dbe038/DSCF1825.jpg',
        '3c7bcd53-8f82-4e2f-9c5a-a8fc6eed7237/DSCF4544.JPEG',
        '9f8e034a-f8d7-44b8-a0d7-7152e0d9d252/DSCF1852.jpg',
        'c35ca659-14d6-4887-94c1-40db8a0a8bd4/DSCF4546.JPEG',
        'd379d421-e5b4-4363-98bd-ef17b0ff4220/DSCF4552.JPEG',
        '44a6b730-497b-4728-b5fd-b510d43159a0/DSCF4561.JPEG',
        'a58cbb7c-aece-49bd-9f42-a756d460f594/DSCF4563.JPEG',
        '1918e7d4-9202-4f33-a170-2348f59cfb19/DSCF1784.jpg',
        '1ffb05ff-1402-4c2a-a808-b3eb810c571e/DSCF4565.JPEG',
        '41d6ffaa-0255-4a7d-8fa3-2eb61d719620/DSCF7178.jpg',
        '3861dc4b-3695-4691-945c-a36f81ded375/DSCF4568.JPEG',
        '54c34b80-6c88-43f3-9863-250eaf1d0c36/DSCF4780.jpg',
        '8b36a641-497c-48ad-a0f6-11295a01b3fd/DSCF4784.jpg',
        'f4533f9f-7a00-44ea-a404-27cd9021d698/DSCF4611.jpg',
        '62451146-08fc-4e19-8d63-fd26a7329945/DSCF5097.jpg',
        'dba36edc-4604-41c7-8776-71fd6b78bf34/DSCF5098.jpg',
        'dc397f53-2c09-432e-aa23-c58af09f564d/DSCF5108.jpg',
        '42fb591a-916a-47a9-8eb4-b633e11a9f5d/DSCF5122.jpg',
        'e9791ce4-a8c1-4c89-960d-b560b5079487/DSCF5985.jpg',
        '6838c21d-b4ee-4724-b183-49e3c93ae2d9/DSC04310.JPG',
        '648455aa-cd26-43ef-90a9-7197b1c8732a/DSC04313.JPG',
        'cf1c2a8d-2634-49ce-8ec5-01ce618e5ca4/893BD9F1-F200-4266-8AED-42C96EBF61D3-7306-000000DAAC96C045.jpg',
        'b1c53aa4-219c-4063-bbe9-59befbe4d1b9/IMG_0186.jpg',
        'd9020000-0db9-4c69-8bf4-56676f533c6e/IMG_0190.jpg',
        'c40a458e-c419-4a34-8424-f189a0783467/IMG_0260.jpg',
        '1bc6943e-7eb9-4a7f-89aa-fc27697e5f17/IMG_0269.jpg',
        '4d0b4ce0-ebc1-424b-a9b2-ee6f93d8bcd5/IMG_0295.jpg',
        '84e51b2a-14d4-42d3-a6c5-a09aba70fcb2/IMG_0466.jpg',
        '53e004e6-3683-43c4-864a-0e4989bb0693/IMG_0682.jpg',
        '919e53c0-a444-4f6b-b667-ea6e83f24b34/0A4B782C-C456-4F03-A3C0-C2A35139AD14-56208-000007BA2F4E8237.jpg',
        '896c7119-c0fa-4dfe-8184-b10dd1fd06c0/10B1B785-6EA1-42CE-BD10-E8E334B5A709-69630-000009704470C710.jpg',
        'a6761b8f-6026-4efa-841b-f437031ef9f0/64A42828-9AAE-464F-9BF3-6567AFD1706E-69630-00000970480D6EDB.jpg',
        '22c6fc16-46b9-4585-b105-ff4f9585e2a1/DSCF8765.jpg',
        '7f58835b-dd54-48c1-a0d0-60a12b404299/DSCF8767.jpg',
        'b3c8a8ea-5374-477e-8ea6-94ca4f3cd40a/IMG_7064+2.jpeg',
        '70a589a1-6db1-4bc0-801f-d23ac22a4dae/IMG_6859.jpeg',
        'b24081fe-8000-4a30-91a2-1581e14ca398/DSCF9915.JPG',
        'c59d2990-31fb-4666-aacb-9b5bde8fefbe/DSCF1741.jpg',
    ],
    'product': [
        '49220e65-230f-43f8-b6cc-79e11fc5220d/VZN-4.jpg',
        '85c5bd4b-6e6b-45e2-985b-c3651135b959/VZN-8.jpg',
        '55ec293c-9f3b-48fb-b0f5-f63583b01f93/VZN-11.jpg',
        'bc17ee8a-db46-4527-ab57-46aecbb490ac/VZN-5.jpg',
        '729eca35-d4ee-4911-9a4f-f0f453efa985/VZN-1.jpg',
        '8c44a149-279f-4d11-b86e-b31824f71b95/VZN-10+Medium.jpeg',
        '69ae14e2-3d6b-432d-9f83-89800c28792c/VZN-6.jpg',
        '800aa5fd-7a97-42fb-a2a4-bffb3afca28c/VZN-7.jpg',
        'c3a74d5c-6396-4d14-a3c1-b479400137f0/VZN-2.jpeg',
        '82218790-9e2c-405a-80a4-0c69dcee0aa4/VZN-9.jpeg',
        '9810a658-5152-488d-b8a2-ff2500464eec/VZN-3+Medium.jpeg',
    ],
    'street': [
        '434891c8-1735-484b-b25a-132ed7aba4a0/DSCF3539.JPG',
        '7a2a8921-5156-4fcf-bba7-8a6d376b1dbc/DSCF0292.jpg',
        'a57acabd-8f8c-4907-8a36-3693a30f06e5/DSCF2449.JPG',
        '9c708eba-18ef-4cc7-a95d-1adaea5e6328/741F3AB4-D765-4032-96F3-0F04F2581C7F.jpeg',
        '56088694-568e-407b-9a71-71361e6156b1/DSCF2700+Large.jpeg',
        'e75329aa-d399-4300-8f9c-9421c3d304dd/IMG_0184.jpg',
        '0d3afc93-f29f-4060-b33d-4e1ecaf89001/DSCF4156.jpg',
        '88e09041-9ecc-4a60-bf0d-d493cbde2c40/DSCF2767.JPG',
        '079c32d3-42ac-4230-816e-90269ae54666/IMG_0147.jpg',
        'ffe38a00-bd14-49a5-86d6-393af9cfd895/DSCF2362.JPG',
        '44925261-8385-44af-8dd4-2c84528e4a3e/2X4A8080.jpg',
        'c0df318f-2ea1-4a04-bfa7-1f45fa259154/2X4A8146.jpg',
        '293a4b4d-7b6d-4d87-b943-17b1d6cbfb98/2X4A8151.jpg',
        '1d74343e-c340-4eda-a291-3015b4e3f102/2X4A8163.jpg',
        'f2edf37f-4825-42dd-b941-e21878071b1b/2X4A8746.JPF',
        '46013068-49d8-4c61-bb1b-3c0bf76ae0e0/2X4A8759.JPG',
        '48169cb3-1186-46ad-b28b-e0ed03a9b64c/DSCF0605.JPG',
        '0002d928-f071-4681-9517-83f6a02cdee4/DSCF0665.JPG',
        '35500ac6-d415-482a-8edd-8b72c6fa4b2a/DSCF0687.jpg',
        '3d5fbd3b-7434-4271-aaff-3105597fff14/DSCF0688.JPG',
        '5e5446d3-4a5d-4b4f-b3d8-0fa945e3d79c/DSCF2257.JPG',
        '0fcab9ff-5ce9-48ad-a17c-97da03517b6c/DSCF2400.JPG',
        '2ab0ff56-3cef-4d64-8a3c-ec3a4af5bfd1/DSCF2448.JPG',
        '4be24b75-4a5c-4fde-a2c8-c6e7d9a0f071/DSCF2467.JPG',
        '81165e61-90f0-4d20-aab4-1780c19115f1/DSCF2574.jpg',
        '8435f4be-9a15-4bbf-b8cd-a1b667fe3cf4/DSCF2589.jpg',
        'abf95629-e5b4-4f90-8a20-c60618467562/DSCF2797.JPG',
        '4e3cd7a6-d9ae-41d4-af43-3e4d1c97e9e8/DSCF2841.JPG',
        '0efe91a1-e5d3-44b9-aa49-e9de45b2bb4b/DSCF3159.JPG',
        '3188d0f0-4e33-469d-bb97-424ec7964ea5/DSCF3200.JPG',
        '24d804d0-4eee-45e5-b377-84442b7650ea/DSCF3225.JPG',
        'dcb39066-bca9-4914-b729-017909d222e3/DSCF3308.JPG',
        '0d17b8ce-dd37-488a-8704-0cd179d28aa9/IMG_0130.JPG',
        '730a2f34-a469-42de-8215-4badccc00713/IMG_0145.JPG',
        '7ccf0b27-31fb-4725-b67a-d1c6d54dfa3f/IMG_0324.jpg',
        '33d62715-b37f-4ba3-8778-9412d792a72e/IMG_0389.JPG',
        '4cc2eb4a-628e-497d-8003-c2f410a5c526/IMG_0415.jpg',
        '56deb6c6-8052-48c7-a312-41169d5e1ba2/IMG_0444.JPG',
        '02f67085-9caa-4312-bf4f-d388f8a30f6d/IMG_0477.jpg',
        '333e5260-d2dd-418d-a3c8-6713d5a58bad/IMG_0484.jpg',
        '0da6b6e5-ddbf-4cc0-86d0-4be086f4f645/IMG_0487.JPG',
        'd05a83c7-778f-47e0-9083-884a8bdb8e35/IMG_0536.jpg',
        'b446c26d-91d4-4047-8088-764fe5344ccc/IMG_6974.JPG',
        '317338c8-e67a-4f98-bb63-a9495279a7d9/IMG_7356.JPG',
        'f61d96cf-23b2-4731-b639-9bfb249e538d/IMG_7915.JPG',
        'e9770cca-1046-44b4-91db-9f267f53f3d3/IMG_7979.JPG',
        '2e53be0c-328e-4f07-81d3-563958aa6515/IMG_9454.JPG',
        'cd50ae08-ac71-4c33-87c4-f80e72a8c9df/IMG_9481.jpg',
        '7cd8fcde-f690-4350-bf4c-9d80dfdb646b/IMG_9522.jpg',
        '8927175b-4f71-4ca3-9709-cfb31af7f965/IMG_9554.JPG',
        '43764cd9-892d-4d41-95db-427a393289f8/IMG_9605.jpg',
        '9a7542d9-91ac-4a7e-b71f-c1c0557496fb/IMG_9621.jpg',
        '2e429bd3-6c4e-4fc1-b869-d9e3ab6d7218/IMG_9647.jpg',
        'a69e34ae-e813-4fd6-9f2c-0c71765c99f0/IMG_9684.jpg',
        '5530a2e5-6a20-4f4f-a411-6601b2915bff/DSCF4134.jpg',
        '90bb8ba4-34b2-4c17-8d86-493ebd4bf569/DSCF0294.jpg',
        '3b8b2aae-9058-40b8-9ddc-ddcee3aa3a9b/DSCF0295.jpg',
        '42d8a48d-9b3a-45a1-9045-45dc5ddfb52b/DSCF4188.jpg',
        '844c8139-fb75-4d31-ba34-c6146e21e72a/DSCF0297.jpg',
        '140a7b53-9517-4522-b31c-56856f10b353/DSCF2684.jpg',
        'a8c30459-d480-4786-9b79-978374759577/DSCF4852.jpg',
    ],
    'portrait': [
        'bab32f97-397a-4297-bfa8-1eae2c522706/DSCF2237+Medium.jpeg',
        '4e30c41b-9e54-45c8-8cad-b421b5040eb0/DSCF1693+Medium.jpeg',
        '4f725e5e-ec06-4603-add0-ebf9bb9355ea/DSCF2370+Medium.jpeg',
        '954361b2-fd8d-4a66-950d-190c1f0917ea/DSCF1950+Medium.jpeg',
        'd16dd5c1-9b8c-4def-9597-3dff8e0452a9/DSCF1717+Medium.jpeg',
        '774d6ce9-9614-4012-8e2d-87dfb59ddbb9/DSCF1821+Medium.jpeg',
        '62654021-c291-4918-adbf-ca04b91d7273/DSCF1849.jpeg',
        'cd3f0442-3b92-433c-91f2-57360ee72c18/DSCF1772+Medium.jpeg',
        '8bc5964d-f57f-4f27-b52a-c85cc8e5ead0/DSCF1374+Medium.jpeg',
        'dd456b3e-2ed3-47fb-8be7-6e0cf07ab9d4/DSCF2038.JPG',
        '28592a23-c7f9-4d69-91a4-2817e9571692/DSCF1732.JPG',
        '68395b15-db4f-4d3f-8ead-179277b0e20e/DSCF1754.JPG',
        '96d345bc-fd1c-440f-bae2-d066c42cc3d6/DSCF1780.JPG',
        'c2e6f7b2-d019-4c90-8b0a-0d4980a1c112/DSCF1837.JPG',
        '723c3d4e-a85e-4bb2-bb33-1fc2bd1cfe8a/DSCF1921.JPG',
        '1104a417-9d89-46ec-8d48-e50a5914ec4/DSCF1938.JPG',
        '8207360b-bc2d-45c6-a2ec-39ea6fcd60ff/IMG_0722.jpg',
        '815f1436-c2e2-41a0-9adf-59f464aa981e/IMG_0734.jpg',
        'bc98cace-ed8a-4f38-bb97-bc4be1fe3a61/IMG_6102.JPG',
        '60f0bb25-1f43-4e4f-a72c-3b087afd4269/IMG_7837.JPG',
        '4c4e41bf-97dc-4de1-a28c-9769e003493f/IMG_7844.JPG',
        'b199b689-4ddb-451f-ad98-8d9a94712eb1/IMG_7846.JPG',
        'f2f229d7-9515-4aaa-a749-a54edd0297c5/IMG_8307.JPG',
        '975198b4-4bf7-43ce-95b1-00270d2ec705/IMG_8379.JPG',
        '976c720d-f83e-4765-b4da-8093d51cd0f5/IMG_8387.JPG',
        '14977fb4-83d8-49c3-9192-4431541c94db/IMG_8408.JPG',
        '86c06a38-3dec-4ee7-9750-f1cca427ac8a/IMG_8498.JPG',
        'c198be1d-cef4-4e44-a50f-71bc0e708ded/IMG_8560.JPG',
        '07094484-d9a6-49ea-af9d-bfd12691d988/IMG_8625.JPG',
        'e9eee502-4784-4c8b-800a-26445082f803/DSCF5835.jpg',
        'e397b0eb-123e-497f-8ee2-5647e4cb123a/DSCF5875.jpg',
    ],
}

BASE_URL = 'https://images.squarespace-cdn.com/content/v1/676dbe11e77f9863643f12c3/'
SITE_DIR = os.path.dirname(os.path.abspath(__file__))

total = sum(len(v) for v in images.values())
done  = 0
skipped = 0
failed = 0

print(f'Downloading {total} images...\n')

for category, paths in images.items():
    folder = os.path.join(SITE_DIR, 'images', 'gallery', category)
    os.makedirs(folder, exist_ok=True)

    for path in paths:
        filename = path.split('/')[-1]
        dest = os.path.join(folder, filename)

        if os.path.exists(dest):
            skipped += 1
            done += 1
            continue

        url = BASE_URL + path + '?format=2500w'
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=30, context=ssl_ctx) as response:
                with open(dest, 'wb') as f:
                    f.write(response.read())
            done += 1
            print(f'  [{done}/{total}] {category}/{filename}')
            time.sleep(0.15)  # be polite to the CDN
        except Exception as e:
            failed += 1
            done += 1
            print(f'  [{done}/{total}] FAILED {filename}: {e}')

print(f'\nDone. {total - skipped - failed} downloaded, {skipped} already existed, {failed} failed.')
print('\nNext step: run  python3 update-gallery-paths.py  to switch script.js to local paths.')
