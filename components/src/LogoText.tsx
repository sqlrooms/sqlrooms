import {Icon} from '@chakra-ui/react';
import {FC} from 'react';
type Props = {
  width?: number;
};
const LogoText: FC<Props> = (props) => {
  const {width = 100} = props;
  return (
    <Icon
      width={width}
      height={(width / 100) * 21}
      viewBox="0 0 8651 1842"
      __css={{
        path: {fill: 'white', stroke: '#030C1Baa', strokeWidth: 40},
        'path.logo': {fill: '#015A96', stroke: 'none'},
      }}
    >
      <path
        className="logo"
        d="M0 917C0 446 353 57 809 1C820 -0 830 8 830 19V298C830 304 827 309 822 313C786 343 763 387 763 437C763 468 772 497 787 521C791 527 791 535 788 542L484 1068C480 1074 474 1077 468 1078C385 1084 320 1153 320 1237C320 1238 319 1238 319 1238L136 1362C127 1368 115 1365 110 1356C39 1225 0 1076 0 917Z"
      />
      <path
        className="logo"
        d="M629 1162C624 1162 619 1159 616 1154C613 1149 613 1143 616 1139L907 634C914 621 932 621 940 634L1231 1139C1234 1143 1233 1149 1231 1154C1228 1159 1223 1162 1218 1162H629Z"
      />
      <path
        className="logo"
        d="M633 1312C626 1312 620 1316 616 1321C588 1367 537 1398 480 1398C465 1398 452 1396 438 1392C433 1391 427 1391 422 1395L246 1514C236 1520 235 1533 242 1542C411 1726 654 1841 923 1841C1201 1841 1450 1719 1619 1525C1626 1517 1624 1504 1615 1498L1444 1388C1438 1385 1431 1384 1425 1387C1407 1394 1388 1398 1367 1398C1310 1398 1259 1367 1231 1321C1227 1316 1221 1312 1214 1312H633Z"
      />
      <path
        className="logo"
        d="M1363 1068C1367 1074 1373 1077 1379 1078C1453 1083 1513 1139 1525 1210C1526 1216 1529 1221 1534 1224L1721 1343C1730 1349 1742 1346 1747 1336C1811 1211 1847 1068 1847 917C1847 446 1494 57 1038 1C1027 -0 1017 8 1017 19V298C1017 304 1020 309 1025 313C1061 343 1084 387 1084 437C1084 468 1075 497 1060 521C1056 527 1056 535 1059 542L1363 1068Z"
      />
      <path d="M2980 721C2980 725 2978 728 2975 731C2973 733 2970 734 2967 734H2626C2622 734 2620 736 2620 739V901C2620 905 2622 906 2626 906H2850C2854 906 2856 908 2858 910C2861 913 2863 915 2863 919V1020C2863 1024 2861 1027 2858 1029C2856 1032 2854 1033 2850 1033H2626C2622 1033 2620 1034 2620 1038V1326C2620 1329 2619 1333 2616 1335C2614 1337 2611 1339 2608 1339H2486C2482 1339 2479 1337 2476 1335C2474 1333 2473 1329 2473 1326V620C2473 617 2474 614 2476 612C2479 609 2482 608 2486 608H2967C2970 608 2973 609 2975 612C2978 614 2980 617 2980 620V721Z" />
      <path d="M3061 1339C3057 1339 3054 1337 3051 1335C3049 1333 3048 1329 3048 1326V620C3048 617 3049 614 3051 612C3054 609 3057 608 3061 608H3183C3186 608 3189 609 3191 612C3194 614 3195 617 3195 620V1326C3195 1329 3194 1333 3191 1335C3189 1337 3186 1339 3183 1339H3061Z" />
      <path d="M3540 1347C3481 1347 3431 1332 3390 1301C3348 1270 3319 1229 3304 1176C3294 1143 3289 1107 3289 1069C3289 1028 3294 991 3304 958C3320 907 3349 867 3391 837C3432 808 3482 794 3541 794C3598 794 3647 808 3687 837C3727 866 3756 906 3773 957C3784 992 3789 1029 3789 1067C3789 1105 3784 1140 3775 1173C3759 1227 3731 1270 3689 1301C3648 1332 3598 1347 3540 1347ZM3540 1221C3563 1221 3582 1214 3598 1200C3614 1186 3626 1167 3633 1142C3638 1120 3641 1096 3641 1069C3641 1040 3638 1015 3633 995C3625 971 3613 953 3597 940C3581 926 3562 920 3539 920C3515 920 3495 926 3479 940C3464 953 3453 971 3446 995C3440 1012 3438 1036 3438 1069C3438 1100 3440 1125 3445 1142C3452 1167 3463 1186 3479 1200C3496 1214 3516 1221 3540 1221Z" />
      <path d="M3988 1339C3980 1339 3976 1335 3973 1328L3823 815L3822 811C3822 804 3826 801 3834 801H3960C3968 801 3972 804 3974 811L4050 1127C4050 1129 4051 1130 4053 1130C4054 1130 4055 1129 4056 1127L4134 811C4136 804 4141 801 4149 801H4258C4266 801 4271 804 4273 811L4356 1128C4356 1130 4357 1131 4359 1131C4360 1131 4361 1130 4362 1128L4443 811C4445 804 4450 801 4458 801L4583 803C4587 803 4590 804 4591 807C4594 809 4594 812 4594 817L4441 1328C4439 1335 4435 1339 4428 1339H4301C4294 1339 4289 1335 4287 1328L4206 1048C4206 1046 4205 1045 4203 1045C4202 1045 4201 1046 4200 1048L4129 1328C4127 1335 4122 1339 4114 1339H3988Z" />
      <path d="M5267 794C5321 794 5364 810 5395 843C5425 875 5440 921 5440 980V1326C5440 1329 5439 1333 5436 1335C5434 1337 5431 1339 5428 1339H5306C5302 1339 5299 1337 5296 1335C5294 1333 5293 1329 5293 1326V1013C5293 984 5286 962 5271 945C5257 928 5237 920 5213 920C5189 920 5169 928 5153 945C5138 962 5130 984 5130 1012V1326C5130 1329 5129 1333 5126 1335C5124 1337 5121 1339 5118 1339H4997C4993 1339 4990 1337 4987 1335C4985 1333 4984 1329 4984 1326V1013C4984 985 4977 963 4961 946C4946 929 4926 920 4902 920C4880 920 4861 926 4845 940C4831 953 4822 971 4819 995V1326C4819 1329 4818 1333 4815 1335C4813 1337 4810 1339 4807 1339H4685C4681 1339 4678 1337 4675 1335C4673 1333 4672 1329 4672 1326V814C4672 811 4673 808 4675 806C4678 803 4681 802 4685 802H4807C4810 802 4813 803 4815 806C4818 808 4819 811 4819 814V855C4819 857 4820 859 4821 859C4823 860 4824 859 4826 857C4854 815 4898 794 4958 794C4993 794 5023 801 5049 815C5075 830 5096 851 5110 878C5112 882 5114 882 5117 878C5132 850 5153 828 5178 814C5205 800 5234 794 5267 794Z" />
      <path d="M5758 794C5803 794 5843 802 5879 818C5914 833 5942 854 5961 881C5982 908 5992 939 5992 972V1326C5992 1329 5990 1333 5987 1335C5985 1337 5983 1339 5979 1339H5857C5854 1339 5850 1337 5848 1335C5846 1333 5844 1329 5844 1326V1292C5844 1289 5844 1288 5842 1287C5841 1287 5840 1287 5838 1289C5809 1328 5762 1347 5697 1347C5643 1347 5599 1334 5566 1307C5532 1281 5516 1242 5516 1190C5516 1137 5534 1095 5572 1066C5610 1036 5663 1021 5733 1021H5839C5843 1021 5844 1019 5844 1016V993C5844 970 5838 952 5824 940C5810 926 5789 920 5761 920C5739 920 5721 924 5707 931C5693 939 5684 950 5680 964C5677 971 5673 975 5666 974L5540 957C5531 956 5527 953 5528 948C5531 919 5542 892 5563 869C5583 845 5611 827 5644 813C5678 800 5716 794 5758 794ZM5737 1237C5767 1237 5792 1229 5813 1213C5834 1197 5844 1177 5844 1152V1114C5844 1111 5843 1109 5839 1109H5764C5733 1109 5708 1115 5690 1127C5673 1138 5664 1155 5664 1177C5664 1195 5670 1210 5684 1222C5697 1232 5715 1237 5737 1237Z" />
      <path d="M6575 946C6587 981 6593 1023 6593 1071C6593 1119 6587 1163 6574 1202C6558 1246 6532 1282 6497 1308C6463 1334 6421 1347 6370 1347C6320 1347 6281 1329 6253 1295C6252 1293 6250 1292 6249 1293C6247 1293 6247 1295 6247 1297V1520C6247 1524 6245 1526 6243 1529C6240 1531 6238 1533 6234 1533H6112C6109 1533 6105 1531 6103 1529C6101 1526 6100 1524 6100 1520V814C6100 811 6101 808 6103 806C6105 803 6109 802 6112 802H6234C6238 802 6240 803 6243 806C6245 808 6247 811 6247 814V849C6247 851 6247 852 6249 853C6250 853 6252 852 6253 851C6282 813 6323 794 6374 794C6422 794 6464 807 6498 834C6534 861 6559 898 6575 946ZM6415 1180C6432 1153 6441 1116 6441 1069C6441 1025 6434 991 6419 965C6403 935 6377 920 6342 920C6310 920 6286 935 6270 965C6255 990 6248 1025 6248 1070C6248 1117 6255 1153 6271 1179C6287 1207 6310 1221 6342 1221C6373 1221 6397 1207 6415 1180Z" />
      <path d="M7164 1347C7110 1347 7062 1336 7021 1316C6980 1294 6948 1264 6926 1226C6904 1187 6893 1143 6893 1093V852C6893 802 6904 758 6926 719C6948 681 6980 652 7021 631C7062 610 7110 599 7164 599C7218 599 7265 609 7305 630C7346 649 7378 677 7400 714C7423 750 7434 792 7434 841C7434 847 7430 851 7422 852L7300 859H7298C7291 859 7287 855 7287 848C7287 811 7276 781 7253 759C7230 737 7201 726 7164 726C7126 726 7096 737 7073 759C7051 781 7040 811 7040 848V1099C7040 1136 7051 1165 7073 1187C7096 1209 7126 1221 7164 1221C7201 1221 7230 1209 7253 1187C7276 1165 7287 1136 7287 1099C7287 1092 7291 1088 7300 1088L7422 1093C7425 1093 7428 1094 7430 1096C7433 1098 7434 1101 7434 1104C7434 1152 7423 1194 7400 1231C7378 1268 7346 1296 7305 1317C7265 1337 7218 1347 7164 1347Z" />
      <path d="M7612 741C7589 741 7569 734 7553 718C7537 702 7530 683 7530 659C7530 634 7537 615 7553 599C7568 584 7588 576 7612 576C7637 576 7656 584 7672 599C7687 615 7695 634 7695 659C7695 683 7687 702 7671 718C7655 734 7636 741 7612 741ZM7550 1339C7546 1339 7543 1337 7540 1335C7538 1333 7537 1329 7537 1326V813C7537 810 7538 807 7540 805C7543 802 7546 801 7550 801H7672C7675 801 7678 802 7680 805C7683 807 7684 810 7684 813V1326C7684 1329 7683 1333 7680 1335C7678 1337 7675 1339 7672 1339H7550Z" />
      <path d="M8107 907C8107 911 8106 914 8103 917C8101 919 8098 920 8094 920H7994C7991 920 7989 922 7989 925V1146C7989 1169 7994 1186 8003 1198C8012 1209 8028 1214 8049 1214H8083C8086 1214 8089 1216 8091 1218C8094 1221 8095 1223 8095 1227V1326C8095 1334 8091 1338 8083 1340C8054 1341 8033 1342 8020 1342C7963 1342 7919 1332 7891 1313C7862 1294 7848 1258 7847 1205V925C7847 922 7845 920 7842 920H7782C7779 920 7776 919 7773 917C7771 914 7770 911 7770 907V814C7770 811 7771 808 7773 806C7776 803 7779 802 7782 802H7842C7845 802 7847 800 7847 797V672C7847 669 7848 666 7850 664C7853 661 7856 660 7860 660H7976C7980 660 7983 661 7985 664C7988 666 7989 669 7989 672V797C7989 800 7991 802 7994 802H8094C8098 802 8101 803 8103 806C8106 808 8107 811 8107 814V907Z" />
      <path d="M8192 1546C8190 1546 8189 1545 8187 1542C8186 1540 8185 1537 8185 1534V1438C8185 1434 8186 1431 8188 1428C8191 1426 8194 1425 8198 1425C8227 1424 8250 1422 8267 1418C8284 1414 8298 1406 8307 1394C8318 1382 8326 1365 8331 1342C8332 1340 8332 1338 8331 1335L8160 815C8159 814 8159 812 8159 810C8159 804 8163 801 8171 801H8301C8309 801 8314 804 8316 811L8403 1150C8404 1152 8405 1153 8406 1153C8408 1153 8409 1152 8410 1150L8497 811C8499 804 8504 801 8512 801H8639C8643 801 8646 802 8648 805C8650 807 8650 811 8649 815L8468 1358C8451 1409 8433 1447 8415 1472C8397 1498 8371 1517 8339 1529C8306 1540 8260 1546 8200 1546H8192Z" />
    </Icon>
  );
};

export default LogoText;
