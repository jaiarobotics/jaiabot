// Adapted From Cheshire, Stuart, and Mary Baker. "Consistent overhead byte
// stuffing." IEEE/ACM Transactions on networking 7.2 (1999): 159-172.
// http://www.stuartcheshire.org/papers/cobsforton.pdf

#ifndef COBS_H
#define COBS_H

#include <stddef.h>
#include <stdint.h>

/*
 * COBSStuffData byte stuffs "length" bytes of
 * data at the location pointed to by "ptr",
 * writing the output to the location pointed
 * to by "dst".
 */
#define COBSFinishBlock(X) (*code_ptr = (X), code_ptr = dst++, code = 0x01)
void COBSStuffData(const unsigned char* ptr, unsigned long length, unsigned char* dst)
{
    const unsigned char* end = ptr + length;
    unsigned char* code_ptr = dst++;
    unsigned char code = 0x01;
    while (ptr < end)
    {
        if (*ptr == 0)
            COBSFinishBlock(code);
        else
        {
            *dst++ = *ptr;
            code++;
            if (code == 0xFF)
                COBSFinishBlock(code);
        }
        ptr++;
    }
    COBSFinishBlock(code);
}
#undef COBSFinishBlock

/*
 * COBSUnStuffData decodes "length" bytes of
 * data at the location pointed to by "ptr",
 * writing the output to the location pointed
 * to by "dst".
 */
void COBSUnStuffData(const unsigned char* ptr, unsigned long length, unsigned char* dst)
{
    const unsigned char* end = ptr + length;
    while (ptr < end)
    {
        int i, code = *ptr++;
        for (i = 1; i < code; i++) *dst++ = *ptr++;
        if (code < 0xFF)
            *dst++ = 0;
    }
}
#endif
